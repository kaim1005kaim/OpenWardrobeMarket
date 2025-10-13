import { PrismaClient } from '@prisma/client';

interface GenParams {
  vibe?: string;
  palette?: string;
  silhouette?: string;
  season?: string;
  fabric?: string;
  priceBand?: string;
  signature?: string;
  notes?: string;
  axisCleanBold?: number;
  axisClassicFuture?: number;
  axisSoftSharp?: number;
}

// Safe join function from the spec
function safeJoin(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" | ");
}

// Persona words mapping from the spec
function personaWords(g: GenParams): string[] {
  const pickAxis = (v: number | undefined, low: string, mid: string, high: string) =>
    typeof v !== "number" ? null : v <= 33 ? low : v >= 67 ? high : mid;

  const words = [
    pickAxis(g.axisCleanBold, "clean", "balanced", "bold"),
    pickAxis(g.axisClassicFuture, "classic", "balanced", "future"),
    pickAxis(g.axisSoftSharp, "soft", "balanced", "sharp")
  ].filter(Boolean) as string[];

  const nonBalanced = words.filter((w) => w !== "balanced");
  return nonBalanced.length ? Array.from(new Set(nonBalanced)) : (words.length ? ["balanced"] : []);
}

// Build prompt from params
function buildPrompt(g: GenParams): string {
  const axesProvided = [g.axisCleanBold, g.axisClassicFuture, g.axisSoftSharp]
    .some((v) => typeof v === "number");
  const tones = axesProvided ? personaWords(g).map((w) => `tone:${w}`) : [];
  
  const basePrompt = safeJoin([
    g.vibe && `${g.vibe} fashion`,
    ...tones,
    g.silhouette && `${g.silhouette} silhouette`,
    g.palette && `${g.palette} palette`,
    g.season && `${g.season} season`,
    g.fabric && `${g.fabric} fabric`,
    g.priceBand && `${g.priceBand} band`,
    g.signature,
    g.notes
  ]);
  
  // Add automatic composition and style elements
  const autoElements = "single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography";
  
  return basePrompt ? `${basePrompt} | ${autoElements}` : autoElements;
}

// Generate params from sliders and mode
function paramsFromSliders(g: GenParams, mode: 'quick' | 'pro') {
  const axis = g.axisCleanBold ?? 50;
  
  if (mode === 'quick') {
    return {
      s: 50 + Math.round(axis * 2.0), // 50-250
      q: 1,
      quality: "standard"
    };
  } else {
    return {
      s: 100 + Math.round(axis * 2.5), // 100-350  
      q: 2,
      quality: "high"
    };
  }
}

// Negative prompt (always applied)
const NEGATIVE_PROMPT = "text, words, letters, typography, signs, labels, multiple people, collage, grid, panels, frames, split screen, comic style, manga panels, multiple angles, contact sheet";

// Process generation job
export async function processGeneration(jobId: string, prisma: PrismaClient) {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId }
  });
  
  if (!job) {
    throw new Error('Job not found');
  }
  
  try {
    // Update status to submitted
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'submitted', progress: 10 }
    });
    
    const { mode, params: jobParams } = job;
    const { count, aspectRatio, ...genParams } = jobParams as any;
    
    // Build the prompt
    const prompt = buildPrompt(genParams);
    const sliderParams = paramsFromSliders(genParams, mode as 'quick' | 'pro');
    
    console.log(`[Generation] Job ${jobId}: ${mode} mode with prompt: "${prompt}"`);
    
    // Prepare ImagineAPI payload
    const payload = {
      model: process.env.IMAGINE_API_MODEL || 'mj',
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      quality: sliderParams.quality,
      params: {
        q: sliderParams.q,
        s: sliderParams.s,
        v: 7, // Try v7, fallback to 6.1 if needed
        aspectRatio: aspectRatio || '3:4'
      },
      count: count || 6
    };
    
    // Update status to generating
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'generating', progress: 25 }
    });
    
    // Call ImagineAPI
    const timeout = mode === 'pro' ? 60000 : parseInt(process.env.IMAGINE_API_TIMEOUT_MS || '30000');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(`${process.env.IMAGINE_API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.IMAGINE_API_TOKEN}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`ImagineAPI error: ${response.status} - ${errorData.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update progress
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { progress: 75 }
      });
      
      // Extract image URLs from response (adapt based on actual API response format)
      let resultUrls: string[] = [];
      if (result.results && Array.isArray(result.results)) {
        resultUrls = result.results.map((r: any) => r.image_url || r.url).filter(Boolean);
      } else if (result.images && Array.isArray(result.images)) {
        resultUrls = result.images.map((img: any) => img.url).filter(Boolean);
      } else if (result.url) {
        resultUrls = [result.url];
      }
      
      if (resultUrls.length === 0) {
        throw new Error('No image URLs returned from API');
      }
      
      // Save images to database
      for (const url of resultUrls) {
        await prisma.image.create({
          data: {
            jobId,
            prompt,
            imageUrl: url,
            userId: job.userId
          }
        });
      }
      
      // Update job as completed
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { 
          status: 'completed',
          progress: 100,
          resultUrls
        }
      });
      
      console.log(`[Generation] Job ${jobId} completed with ${resultUrls.length} images`);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        // Timeout
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { 
            status: 'timeout',
            error: { message: `Request timeout after ${timeout}ms` }
          }
        });
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      // If Pro mode fails, try fallback to Quick mode once
      if (mode === 'pro' && !job.error) {
        console.log(`[Generation] Job ${jobId} Pro mode failed, trying Quick fallback`);
        
        const quickParams = paramsFromSliders(genParams, 'quick');
        const fallbackPayload = {
          ...payload,
          quality: quickParams.quality,
          params: {
            ...payload.params,
            q: quickParams.q,
            s: quickParams.s
          }
        };
        
        try {
          const fallbackResponse = await fetch(`${process.env.IMAGINE_API_URL}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.IMAGINE_API_TOKEN}`
            },
            body: JSON.stringify(fallbackPayload),
            signal: AbortSignal.timeout(30000) // 30s for fallback
          });
          
          if (fallbackResponse.ok) {
            const fallbackResult = await fallbackResponse.json();
            
            let resultUrls: string[] = [];
            if (fallbackResult.results && Array.isArray(fallbackResult.results)) {
              resultUrls = fallbackResult.results.map((r: any) => r.image_url || r.url).filter(Boolean);
            }
            
            if (resultUrls.length > 0) {
              for (const url of resultUrls) {
                await prisma.image.create({
                  data: {
                    jobId,
                    prompt,
                    imageUrl: url,
                    userId: job.userId
                  }
                });
              }
              
              await prisma.generationJob.update({
                where: { id: jobId },
                data: { 
                  status: 'completed',
                  progress: 100,
                  resultUrls,
                  error: { message: 'Completed with fallback to quick mode', reason: 'fallback_to_quick' }
                }
              });
              
              console.log(`[Generation] Job ${jobId} completed with Quick fallback`);
              return;
            }
          }
        } catch (fallbackError) {
          console.error(`[Generation] Job ${jobId} fallback also failed:`, fallbackError);
        }
      }
      
      throw fetchError;
    }
    
  } catch (error: any) {
    console.error(`[Generation] Job ${jobId} failed:`, error);
    
    // Update job as failed
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { 
        status: 'failed',
        error: { 
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }
    });
    
    throw error;
  }
}
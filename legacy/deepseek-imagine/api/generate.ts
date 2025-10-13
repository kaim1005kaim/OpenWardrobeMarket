import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const IMAGINE_API_TOKEN = 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';
const IMAGINE_API_BASE = 'https://cl.imagineapi.dev';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    console.log('[Generate] Request received:', {
      method: req.method,
      body: req.body,
      headers: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });

    const { 
    prompt, 
    mode = 'simple',  // simple, heritage, zero, mutation, reinterpret
    heritage,         // { code: string, ratio: number }
    subtractor,       // { code: string, ratio: number }
    constraints,      // string[] for mutation mode
    materials,        // string[] for mutation mode
    count = 1,
    aspect_ratio = '2:3',  // Fashion portrait ratio
    style = 'NATURAL',
    chaos,
    quality,
    stylize,
    weird,
    seed,
    user_id,
    source = 'chat',   // 'chat' or 'creator'
    negative_prompt
  } = req.body;

    if (!prompt) {
      console.error('[Generate] No prompt provided');
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Build Midjourney-style prompt with parameters
    let fullPrompt = prompt;
    
    // Add aspect ratio
    if (aspect_ratio) {
      fullPrompt += ` --ar ${aspect_ratio}`;
    }
    
    // Add seed if specified
    if (seed) {
      fullPrompt += ` --seed ${seed}`;
    }
    
    // Add negative prompt only if not already present
    if (negative_prompt && !fullPrompt.includes('--no')) {
      fullPrompt += ` --no ${negative_prompt}`;
    }
    
    // Add style parameters if specified (check for v6 compatibility)
    const isV6 = fullPrompt.includes('--v 6') || fullPrompt.includes('--version 6');
    
    if (chaos) fullPrompt += ` --chaos ${chaos}`;
    if (quality) fullPrompt += ` --quality ${quality}`;
    if (stylize && !isV6) fullPrompt += ` --stylize ${stylize}`; // stylize not compatible with v6
    if (weird && !isV6) fullPrompt += ` --weird ${weird}`; // weird not compatible with v6
    
    console.log(`[Generate] Full prompt: "${fullPrompt}"`);

    // Generate unique ref for webhook tracking
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ref = user_id ? `${user_id}:${requestId}` : requestId;
    
    // Store session data for webhook processing
    if (user_id) {
      // In production, this would be stored in Redis or database
      // For now, we'll use the webhook handler's session store
      const sessionData = {
        user_id,
        prompt: fullPrompt,
        parameters: { mode, aspect_ratio, style, chaos, quality, stylize, weird, seed },
        session_id: requestId,
        created_at: Date.now()
      };
      
      // Store session data globally (this is a hack, in production use Redis)
      global.activeSessions = global.activeSessions || new Map();
      global.activeSessions.set(requestId, sessionData);
    }
    
    console.log(`[Generate] Starting generation with ref: ${ref}`);

    // Send single request to ImagineAPI (it returns 4 images automatically)
    // NOTE: Webhookはダッシュボードで設定する必要がある
    const generateResponse = await fetch(`${IMAGINE_API_BASE}/items/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        ref: ref  // For webhook tracking (refフィールドはトラッキング用に使える可能性)
      })
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error(`[Generate] Failed to start generation:`, {
        status: generateResponse.status,
        statusText: generateResponse.statusText,
        error: errorText
      });
      return res.status(500).json({ 
        error: 'Failed to start generation',
        details: `API returned ${generateResponse.status}: ${errorText}`
      });
    }

    const generateResult = await generateResponse.json();
    const imageId = generateResult.data.id;
    console.log(`[Generate] Started generation with ID: ${imageId}`);

    // Save to generation_history for webhook tracking
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        );

        const generationData = {
          job_id: ref,  // This is what webhook will look for
          image_id: imageId,  // ImagineAPI task ID
          prompt: fullPrompt,
          mode: mode,
          parameters: { 
            aspect_ratio, style, chaos, quality, stylize, weird, seed,
            heritage, subtractor, constraints, materials
          },
          session_id: requestId,
          source: source
        };

        // CRITICAL: Save image_id <-> job_id mapping for webhook to find
        const { error: mappingError } = await supabase
          .from('imagine_task_map')
          .upsert({
            task_id: imageId,  // ImagineAPI's ID (will come as evt.id in webhook)
            job_id: ref        // Our job ID (user_id:requestId format)
          });

        if (mappingError) {
          console.error('[Generate] Failed to save task mapping:', mappingError);
        } else {
          console.log('[Generate] Saved task mapping:', { task_id: imageId, job_id: ref });
        }

        // Also save to generation_history for backward compatibility
        const { error: insertError } = await supabase
          .from('generation_history')
          .insert({
            user_id: user_id || null,
            generation_data: generationData,
            completion_status: 'processing'
          });

        if (insertError) {
          console.error('[Generate] Failed to save generation history:', insertError);
        } else {
          console.log('[Generate] Saved generation history with job_id:', ref);
        }
      } catch (dbError) {
        console.error('[Generate] Database error:', dbError);
        // Continue anyway - generation is more important
      }
    } else {
      console.log('[Generate] Skipping generation_history save - database not configured');
    }

    // Save generation metadata for mode-specific features
    if (mode !== 'simple' && user_id) {
      try {
        // Prepare recipe params
        const recipeParams: any = { mode };
        if (heritage) recipeParams.heritage = heritage;
        if (subtractor) recipeParams.subtractor = subtractor;
        if (constraints) recipeParams.constraints = constraints;
        if (materials) recipeParams.materials = materials;
        
        // Store in session data for webhook to access
        if (global.activeSessions) {
          const sessionData = global.activeSessions.get(requestId);
          if (sessionData) {
            sessionData.generation_mode = mode;
            sessionData.recipe_params = recipeParams;
            global.activeSessions.set(requestId, sessionData);
          }
        }
        
        console.log(`[Generate] Stored mode-specific data for ${mode} generation`);
      } catch (dbError) {
        console.error('[Generate] Failed to store mode metadata:', dbError);
        // Continue anyway - generation is more important
      }
    }

    // Return immediately - webhook will handle the completion
    res.status(202).json({
      success: true,
      status: 'queued',
      image_id: imageId,
      ref: ref,
      session_id: requestId,
      job_id: ref,  // Add job_id for new SSE system
      message: 'Generation started - results will be delivered via webhook',
      mode: mode,    // Include mode in response
      // For backward compatibility, provide polling endpoint
      poll_url: `/api/generate-status/${imageId}`,
      sse_url: `/api/sse/${requestId}`
    });

  } catch (error) {
    console.error('[Generate] Error:', error);
    res.status(500).json({ 
      error: 'Generation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
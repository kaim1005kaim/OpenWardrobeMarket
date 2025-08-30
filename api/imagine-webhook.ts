import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../src/app/lib/supabase';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.IMAGINE_WEBHOOK_SECRET;

// Use global session store shared with generate.ts (in production, use Redis)
function getActiveSessions() {
  if (typeof global !== 'undefined') {
    global.activeSessions = global.activeSessions || new Map();
    return global.activeSessions;
  }
  return new Map();
}

interface WebhookEvent {
  type: 'image.queued' | 'image.progress' | 'image.completed' | 'image.failed';
  data: {
    id: string;
    ref?: string;
    status: string;
    progress?: number;
    url?: string;
    upscaled_urls?: string[];
    error?: string;
    prompt?: string;
  };
  timestamp: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log all webhook requests for debugging
  console.log('[Webhook] Request received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Skip signature verification for now (ImagineAPI doesn't support it yet)
    // TODO: Re-enable when ImagineAPI adds signature support
    /*
    if (WEBHOOK_SECRET) {
      const signature = req.headers['x-imagine-signature'] as string;
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      
      if (!signature || !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      )) {
        console.error('[Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    */

    const event: WebhookEvent = req.body;
    const { type, data } = event;
    const imageId = data.id;
    const ref = data.ref; // Contains user_id and session info

    console.log('[Webhook] Received event:', { type, imageId, ref, status: data.status });

    // Parse ref to get user_id and session info
    let user_id: string | null = null;
    let sessionData: any = null;
    const activeSessions = getActiveSessions();

    if (ref) {
      // ref format: "user_id:timestamp-random" or just "timestamp-random"
      const parts = ref.split(':');
      if (parts.length === 2) {
        user_id = parts[0];
        const sessionKey = parts[1];
        sessionData = activeSessions.get(sessionKey);
      }
    }

    // Handle different event types
    switch (type) {
      case 'image.queued':
        console.log('[Webhook] Image queued:', imageId);
        // Optionally store job status in database
        break;

      case 'image.progress':
        console.log('[Webhook] Progress update:', {
          imageId,
          progress: data.progress,
          status: data.status
        });
        
        // Broadcast progress to connected clients (SSE/WebSocket)
        await broadcastProgress(imageId, {
          progress: data.progress || 0,
          status: data.status
        });
        break;

      case 'image.completed':
        console.log('[Webhook] Generation completed:', imageId);
        
        if (data.upscaled_urls && data.upscaled_urls.length > 0 && user_id && sessionData) {
          try {
            // Process and save completed images
            const savedImages = await processCompletedImages(
              user_id,
              data.upscaled_urls,
              sessionData.prompt,
              sessionData.parameters,
              sessionData.session_id,
              imageId
            );

            // Broadcast completion to client
            await broadcastCompletion(imageId, {
              images: savedImages,
              message: 'デザインが完成しました！'
            });

            // Cleanup session data
            activeSessions.delete(sessionData.session_id);
          } catch (error) {
            console.error('[Webhook] Error processing completed images:', error);
            await broadcastError(imageId, 'Image processing failed');
          }
        } else {
          console.warn('[Webhook] Incomplete completion data:', { data, user_id, sessionData });
        }
        break;

      case 'image.failed':
        console.log('[Webhook] Generation failed:', {
          imageId,
          error: data.error
        });

        await broadcastError(imageId, data.error || 'Generation failed');
        
        // Cleanup session data if available
        if (ref && sessionData) {
          activeSessions.delete(sessionData.session_id);
        }
        break;

      default:
        console.log('[Webhook] Unknown event type:', type);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function processCompletedImages(
  user_id: string,
  imageUrls: string[],
  prompt: string,
  parameters: any,
  session_id: string,
  imagine_id: string
) {
  // Record generation in history
  const { data: historyData, error: historyError } = await supabase
    .from('generation_history')
    .insert({
      user_id,
      session_id,
      prompt,
      parameters,
      result_images: imageUrls,
      status: 'completed'
    })
    .select()
    .single();

  if (historyError) {
    throw historyError;
  }

  const savedImages = [];

  // Process each image
  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      // Download image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) continue;

      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      
      // Generate R2 key
      const timestamp = new Date().toISOString().slice(0, 10);
      const imageId = `${imagine_id}-${index}`;
      const extension = contentType.includes('png') ? 'png' : 'jpg';
      const r2Key = `generated/${user_id}/${timestamp}/${imageId}.${extension}`;

      // Upload to R2
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: new Uint8Array(imageBuffer),
        ContentType: contentType,
        Metadata: {
          'user-id': user_id,
          'generation-id': historyData.id,
          'prompt': prompt.slice(0, 500),
          'imagine-id': imagine_id
        }
      }));

      const r2PublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${r2Key}`;

      // Save to database
      const { data: imageData, error: imageError } = await supabase
        .from('images')
        .insert({
          title: generateImageTitle(prompt, index),
          r2_url: r2PublicUrl,
          r2_key: r2Key,
          user_id,
          type: 'generated',
          tags: extractTagsFromPrompt(prompt),
          colors: extractColorsFromParams(parameters),
          width: 1024,
          height: 1536,
          is_public: true,
          generation_params: parameters,
          original_prompt: prompt,
          aspect_ratio: '2:3'
        })
        .select()
        .single();

      if (!imageError && imageData) {
        savedImages.push({
          id: imageData.id,
          url: r2PublicUrl,
          title: imageData.title,
          tags: imageData.tags,
          colors: imageData.colors
        });
      }
    } catch (error) {
      console.error(`[Webhook] Error processing image ${index}:`, error);
      continue;
    }
  }

  return savedImages;
}

// Broadcast functions for real-time updates
async function broadcastProgress(imageId: string, data: any) {
  const activeSessions = getActiveSessions();
  
  // Find session by imageId (stored in session data)
  for (const [sessionId, session] of activeSessions) {
    // Broadcast to all sessions that might be waiting for this imageId
    if (global.broadcastToSession) {
      global.broadcastToSession(sessionId, {
        type: 'progress',
        imageId,
        ...data,
        timestamp: Date.now()
      });
    }
  }
  
  console.log('[Broadcast] Progress:', imageId, data);
}

async function broadcastCompletion(imageId: string, data: any) {
  const activeSessions = getActiveSessions();
  
  // Find the specific session for this completion
  for (const [sessionId, session] of activeSessions) {
    if (global.broadcastToSession) {
      global.broadcastToSession(sessionId, {
        type: 'completed',
        imageId,
        ...data,
        timestamp: Date.now()
      });
    }
  }
  
  console.log('[Broadcast] Completion:', imageId, data);
}

async function broadcastError(imageId: string, error: string) {
  const activeSessions = getActiveSessions();
  
  for (const [sessionId, session] of activeSessions) {
    if (global.broadcastToSession) {
      global.broadcastToSession(sessionId, {
        type: 'failed',
        imageId,
        error,
        timestamp: Date.now()
      });
    }
  }
  
  console.log('[Broadcast] Error:', imageId, error);
}

function generateImageTitle(prompt: string, index: number): string {
  const words = prompt
    .toLowerCase()
    .replace(/--\w+\s+[\w\s,]+/g, '')
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 4);
  
  const baseTitle = words.join(' ').replace(/[^a-z0-9\s]/gi, '');
  return `${baseTitle} #${index + 1}`.trim() || `Generated Design #${index + 1}`;
}

function extractTagsFromPrompt(prompt: string): string[] {
  const keywords = [
    'minimal', 'street', 'luxury', 'casual', 'elegant', 'sophisticated',
    'avant-garde', 'retro', 'vintage', 'modern', 'classic', 'edgy',
    'oversized', 'tailored', 'flowing', 'structured', 'cropped',
    'monochrome', 'colorful', 'neutral', 'bold', 'pastel'
  ];

  return keywords.filter(keyword => 
    prompt.toLowerCase().includes(keyword)
  ).slice(0, 8);
}

function extractColorsFromParams(parameters: any): string[] {
  const colors = [];
  
  if (parameters?.palette) {
    switch (parameters.palette.toLowerCase()) {
      case 'monochrome':
        colors.push('black', 'white', 'gray');
        break;
      case 'neutral':
        colors.push('beige', 'cream', 'taupe');
        break;
      case 'earth':
        colors.push('brown', 'tan', 'olive');
        break;
      case 'neon':
        colors.push('electric blue', 'hot pink', 'lime green');
        break;
      default:
        colors.push(parameters.palette);
    }
  }

  return colors.slice(0, 5);
}

// Export session management functions for use in generate.ts
export function addActiveSession(sessionId: string, data: any) {
  const activeSessions = getActiveSessions();
  activeSessions.set(sessionId, {
    ...data,
    created_at: Date.now()
  });
}

export function getActiveSession(sessionId: string) {
  const activeSessions = getActiveSessions();
  return activeSessions.get(sessionId);
}
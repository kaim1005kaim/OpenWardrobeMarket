import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// Service role client for webhook operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// R2 Configuration
const r2Client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${R2_BUCKET}.r2.dev`;

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.IMAGINE_WEBHOOK_SECRET;

interface WebhookEvent {
  id?: string; // Event ID for idempotency
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
    images?: Array<{
      url: string;
      width?: number;
      height?: number;
      index?: number;
    }>;
  };
  timestamp: number;
}

interface ProcessedImageData {
  assetId: string;
  r2Url: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Respond immediately with 200 to prevent retries
  res.status(200).json({ success: true });

  // Process webhook asynchronously
  processWebhookAsync(req).catch(error => {
    console.error('[Webhook] Async processing failed:', error);
  });
}

async function processWebhookAsync(req: NextApiRequest) {
  console.log('[Webhook] Request received:', {
    method: req.method,
    headers: Object.keys(req.headers),
    bodyKeys: Object.keys(req.body || {})
  });

  if (req.method !== 'POST') {
    console.error('[Webhook] Invalid method:', req.method);
    return;
  }

  try {
    const event: WebhookEvent = req.body;
    
    // Verify webhook signature if available
    if (WEBHOOK_SECRET && req.headers['x-imagine-signature']) {
      const isValid = await verifyWebhookSignature(req, WEBHOOK_SECRET);
      if (!isValid) {
        console.error('[Webhook] Invalid signature');
        return;
      }
    }

    // Ensure idempotency
    const eventId = event.id || `${event.data.id}-${event.type}-${event.timestamp}`;
    const isProcessed = await checkAndMarkEventProcessed(eventId, event);
    
    if (isProcessed) {
      console.log('[Webhook] Event already processed:', eventId);
      return;
    }

    console.log('[Webhook] Processing event:', {
      type: event.type,
      imageId: event.data.id,
      ref: event.data.ref,
      status: event.data.status
    });

    // Route to appropriate handler
    switch (event.type) {
      case 'image.queued':
        await handleImageQueued(event);
        break;
      case 'image.progress':
        await handleImageProgress(event);
        break;
      case 'image.completed':
        await handleImageCompleted(event);
        break;
      case 'image.failed':
        await handleImageFailed(event);
        break;
      default:
        console.warn('[Webhook] Unknown event type:', event.type);
    }

    // Mark event as processed
    await markEventProcessed(eventId);

  } catch (error) {
    console.error('[Webhook] Error processing:', error);
  }
}

async function verifyWebhookSignature(req: NextApiRequest, secret: string): Promise<boolean> {
  try {
    const signature = req.headers['x-imagine-signature'] as string;
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature.replace('sha256=', '')),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Webhook] Signature verification error:', error);
    return false;
  }
}

async function checkAndMarkEventProcessed(eventId: string, event: WebhookEvent): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('event_log')
      .select('id, processed')
      .eq('ext_id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error is OK
      throw error;
    }

    if (data?.processed) {
      return true; // Already processed
    }

    // Insert or update event log
    await supabase
      .from('event_log')
      .upsert({
        ext_id: eventId,
        event_type: `webhook.${event.type}`,
        payload: event,
        processed: false
      }, {
        onConflict: 'ext_id'
      });

    return false; // Not processed yet
  } catch (error) {
    console.error('[Webhook] Error checking event processed:', error);
    return false;
  }
}

async function markEventProcessed(eventId: string) {
  try {
    await supabase
      .from('event_log')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('ext_id', eventId);
  } catch (error) {
    console.error('[Webhook] Error marking event processed:', error);
  }
}

async function handleImageQueued(event: WebhookEvent) {
  const { data } = event;
  console.log('[Webhook] Image queued:', data.id);

  // Update generation status
  await updateGenerationStatus(data.id, 'processing', {
    status: data.status,
    progress: 0
  });

  // Broadcast to SSE clients
  await broadcastToSSE(data.id, {
    kind: 'progress',
    progress: 0,
    status: data.status || 'queued',
    message: 'Generation started'
  });
}

async function handleImageProgress(event: WebhookEvent) {
  const { data } = event;
  console.log('[Webhook] Progress update:', {
    imageId: data.id,
    progress: data.progress,
    status: data.status
  });

  // Update generation status
  await updateGenerationStatus(data.id, 'processing', {
    status: data.status,
    progress: data.progress || 0
  });

  // Broadcast to SSE clients
  await broadcastToSSE(data.id, {
    kind: 'progress',
    progress: data.progress || 0,
    status: data.status || 'processing',
    message: `Generating... ${data.progress || 0}%`
  });
}

async function handleImageCompleted(event: WebhookEvent) {
  const { data } = event;
  console.log('[Webhook] Image completed:', data.id);

  try {
    // Process all generated images (up to 4)
    const images = data.images || (data.url ? [{ url: data.url, index: 1 }] : []);
    const processedImages: ProcessedImageData[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imageIndex = image.index || (i + 1);
      
      try {
        console.log(`[Webhook] Processing image ${imageIndex}:`, image.url);
        
        // Download and upload to R2
        const r2Data = await copyImageToR2(data.id, imageIndex, image.url);
        
        // Save to database using the stored procedure
        const { data: assetData, error } = await supabase
          .rpc('upsert_asset_from_imagine', {
            p_job_id: data.id,
            p_image_index: imageIndex,
            p_image_url: image.url,
            p_r2_url: r2Data.publicUrl,
            p_width: image.width,
            p_height: image.height,
            p_file_size: r2Data.fileSize
          });

        if (error) throw error;

        processedImages.push({
          assetId: assetData,
          r2Url: r2Data.publicUrl,
          width: image.width,
          height: image.height,
          fileSize: r2Data.fileSize
        });

        console.log(`[Webhook] Successfully processed image ${imageIndex}, asset ID:`, assetData);

      } catch (error) {
        console.error(`[Webhook] Failed to process image ${imageIndex}:`, error);
      }
    }

    // Update generation status
    await updateGenerationStatus(data.id, 'completed', {
      status: 'completed',
      images_processed: processedImages.length
    });

    // Broadcast completion to SSE clients
    await broadcastToSSE(data.id, {
      kind: 'completed',
      progress: 100,
      status: 'completed',
      message: 'Generation completed',
      assets: processedImages
    });

    console.log(`[Webhook] Successfully processed ${processedImages.length} images for job:`, data.id);

  } catch (error) {
    console.error('[Webhook] Error handling completion:', error);
    await handleImageFailed({
      ...event,
      data: {
        ...event.data,
        error: 'Failed to process completed images'
      }
    });
  }
}

async function handleImageFailed(event: WebhookEvent) {
  const { data } = event;
  console.log('[Webhook] Image failed:', data.id, data.error);

  // Update generation status
  await updateGenerationStatus(data.id, 'failed', {
    status: 'failed',
    error: data.error
  });

  // Broadcast failure to SSE clients
  await broadcastToSSE(data.id, {
    kind: 'failed',
    progress: 0,
    status: 'failed',
    message: data.error || 'Generation failed',
    error: data.error
  });
}

async function copyImageToR2(jobId: string, imageIndex: number, imageUrl: string) {
  try {
    console.log(`[Webhook] Downloading image ${imageIndex} from:`, imageUrl);
    
    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const fileSize = imageBuffer.length;
    
    // Generate R2 key
    const r2Key = `generated/${jobId}_${imageIndex}.jpg`;
    
    // Upload to R2
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'job-id': jobId,
        'image-index': imageIndex.toString(),
        'original-url': imageUrl
      }
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`;
    
    console.log(`[Webhook] Successfully uploaded image ${imageIndex} to R2:`, publicUrl);
    
    return {
      r2Key,
      publicUrl,
      fileSize
    };

  } catch (error) {
    console.error(`[Webhook] Error copying image ${imageIndex} to R2:`, error);
    throw error;
  }
}

async function updateGenerationStatus(jobId: string, status: string, metadata: any = {}) {
  try {
    // First get existing data
    const { data: existing } = await supabase
      .from('generation_history')
      .select('generation_data')
      .eq('generation_data->>job_id', jobId)
      .single();
    
    const existingData = existing?.generation_data || {};
    
    await supabase
      .from('generation_history')
      .update({
        completion_status: status,
        webhook_received_at: new Date().toISOString(),
        generation_data: {
          ...existingData,
          webhook_status: status,
          last_update: new Date().toISOString(),
          metadata
        }
      })
      .eq('generation_data->>job_id', jobId);
  } catch (error) {
    console.error('[Webhook] Error updating generation status:', error);
  }
}

async function broadcastToSSE(jobId: string, payload: any) {
  try {
    console.log(`[Webhook] Broadcasting for job:`, jobId);

    const eventData = {
      jobId,
      timestamp: Date.now(),
      ...payload
    };

    // 常にDBに保存（確実性を優先）
    await saveToDatabase(jobId, eventData);
    
    // KVは無効化（Serverless環境でのエラーを防ぐ）
    console.log('[Webhook] Using DB-only mode (KV disabled)');

  } catch (error) {
    console.error('[Webhook] Error broadcasting:', error);
  }
}

async function saveToDatabase(jobId: string, eventData: any) {
  try {
    // event_logテーブルに保存（既存のフォールバック処理）
    await supabase
      .from('event_log')
      .insert({
        ext_id: `${jobId}-${eventData.timestamp}`,
        event_type: `webhook.${eventData.kind || 'update'}`,
        payload: eventData,
        processed: true
      });
    console.log('[Webhook] Saved to database as fallback');
  } catch (dbError) {
    console.error('[Webhook] Database save error:', dbError);
  }
}


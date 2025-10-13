import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ImagineAPI Webhook Payload
type ImagineWebhookEvent = {
  event: "images.items.create" | "images.items.update";
  payload: {
    id: string;
    prompt?: string;
    status: "pending" | "in-progress" | "completed" | "failed";
    progress: number | null;
    url: string | null;
    upscaled_urls: string[] | null;
    error?: string;
  };
};

// R2 Client
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

// Service role client
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Imagine Webhook] Request received:', {
    method: req.method,
    body: req.body
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookEvent = req.body as ImagineWebhookEvent;
    const { payload } = webhookEvent;

    console.log('[Imagine Webhook] Processing:', {
      event: webhookEvent.event,
      id: payload.id,
      status: payload.status,
      progress: payload.progress
    });

    // Find generation_history record by external task_id
    const { data: history } = await supabase
      .from('generation_history')
      .select('*')
      .eq('external_id', payload.id)
      .maybeSingle();

    if (!history) {
      console.warn('[Imagine Webhook] No generation_history found for id:', payload.id);
      return res.status(200).json({ success: true, message: 'No matching record' });
    }

    // Update based on status
    if (payload.status === 'in-progress') {
      await supabase
        .from('generation_history')
        .update({
          completion_status: 'processing',
          generation_data: {
            ...history.generation_data,
            progress: payload.progress,
            preview_url: payload.url
          }
        })
        .eq('id', history.id);

      console.log('[Imagine Webhook] Updated progress:', payload.progress);

    } else if (payload.status === 'completed') {
      // Get the first upscaled URL or fallback to regular URL
      const imageUrl = payload.upscaled_urls?.[0] || payload.url;

      if (!imageUrl) {
        throw new Error('No image URL in completed webhook');
      }

      // Download image from ImagineAPI
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to download image: ${imgResponse.status}`);
      }

      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      const ext = imageUrl.includes('.webp') ? 'webp' : imageUrl.includes('.jpg') ? 'jpg' : 'png';

      // Upload to R2
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = `${now.getMonth() + 1}`.padStart(2, '0');
      const key = `usergen/${history.user_id}/${yyyy}/${mm}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: imgBuffer,
          ContentType: `image/${ext}`,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

      // Update generation_history
      await supabase
        .from('generation_history')
        .update({
          completion_status: 'completed',
          image_url: publicUrl,
          image_path: key,
          image_bucket: R2_BUCKET,
          generation_data: {
            ...history.generation_data,
            upscaled_urls: payload.upscaled_urls
          }
        })
        .eq('id', history.id);

      console.log('[Imagine Webhook] Completed and saved to R2:', key);

    } else if (payload.status === 'failed') {
      await supabase
        .from('generation_history')
        .update({
          completion_status: 'failed',
          generation_data: {
            ...history.generation_data,
            error: payload.error || 'Generation failed'
          }
        })
        .eq('id', history.id);

      console.log('[Imagine Webhook] Marked as failed:', payload.id);
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('[Imagine Webhook] Error:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
}

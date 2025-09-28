// ImagineAPI Webhook受信エンドポイント - ドキュメント準拠版
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// ImagineAPI Webhook公式ドキュメントに基づく構造
type ImagineWebhookEvent = {
  event: "images.items.create" | "images.items.update";
  payload: {
    id: string;
    prompt: string;
    status: "pending" | "in-progress" | "completed" | "failed";
    progress: number | null;
    url: string | null;
    upscaled_urls: string[] | null;
  };
};

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Webhook] ImagineAPI request received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookEvent = req.body as ImagineWebhookEvent;

    console.log('[Webhook] Processing webhook event:', {
      event: webhookEvent.event,
      id: webhookEvent.payload.id,
      status: webhookEvent.payload.status,
      hasUpscaled: !!(webhookEvent.payload.upscaled_urls)
    });

    // 非同期処理を実行してからレスポンス
    await processImagineWebhook(webhookEvent);

    // 成功レスポンス (ImagineAPIはこれを期待)
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ error: 'Webhook error', details: error.message });
  }
}

async function processImagineWebhook(evt: ImagineWebhookEvent) {
  try {
    const { payload } = evt;

    console.log('[Webhook] Processing event:', {
      id: payload.id,
      status: payload.status,
      progress: payload.progress,
      hasUrl: !!payload.url,
      hasUpscaled: !!payload.upscaled_urls
    });

    // 1) task_id => job_id の対応を取得（imagine_task_mapから）
    const { data: mapping } = await supabase
      .from('imagine_task_map')
      .select('job_id')
      .eq('task_id', payload.id)
      .maybeSingle();

    if (!mapping?.job_id) {
      console.warn('[Webhook] No job_id mapping found for task_id:', payload.id);
      return;
    }

    const jobId = mapping.job_id;
    console.log('[Webhook] Found job_id:', jobId, 'for task_id:', payload.id);

    // 2) event_logに正規化して保存（カラムを個別に設定）
    const baseEvent = {
      job_id: jobId,
      image_id: payload.id,
      payload: evt,
      created_at: new Date().toISOString(),
      processed: false
    };

    if (payload.status === "in-progress") {
      const { error } = await supabase
        .from('event_log')
        .insert({
          ...baseEvent,
          ext_id: `${payload.id}-progress-${Date.now()}`,
          event_type: 'progress',
          progress: payload.progress,
          preview_url: payload.url
        });
        
      if (error) {
        console.error('[Webhook] Failed to save progress event:', error);
      } else {
        console.log('[Webhook] Progress event saved:', { jobId, progress: payload.progress });
      }

    } else if (payload.status === "completed") {
      // ImagineAPIでは完了時にurl（単一）とupscaled_urls（配列）が来る
      const urls = payload.upscaled_urls || (payload.url ? [payload.url] : []);

      const { error } = await supabase
        .from('event_log')
        .insert({
          ...baseEvent,
          ext_id: `${payload.id}-completed-${Date.now()}`,
          event_type: 'completed',
          result_urls: urls,
          upscaled_urls: payload.upscaled_urls
        });
        
      if (error) {
        console.error('[Webhook] Failed to save completed event:', error);
      } else {
        console.log('[Webhook] Completed event saved:', {
          jobId,
          urls: urls.length,
          upscaled: payload.upscaled_urls?.length || 0
        });
      }

      // Save individual assets to user_generations table
      if (urls.length > 0) {
        try {
          // Extract user_id from job_id (format: user_id:requestId)
          const userId = jobId.split(':')[0];
          
          // Get generation parameters from event_log or generate defaults
          const generationAssets = urls.map((url: string, index: number) => ({
            user_id: userId,
            job_id: jobId,
            image_id: payload.id,
            title: `Generation ${index + 1}`,
            prompt: payload.prompt || 'Generated image',
            mode: 'unknown', // We'll need to pass this from frontend
            parameters: evt,
            r2_url: url,
            width: 1024, // Default, we'll get actual dimensions later
            height: 1024,
            imagine_image_index: index + 1,
            is_public: false
          }));

          const { error: assetsError } = await supabase
            .from('user_generations')
            .upsert(generationAssets, {
              onConflict: 'job_id,imagine_image_index'
            });

          if (assetsError) {
            console.error('[Webhook] Failed to save generation assets:', assetsError);
          } else {
            console.log('[Webhook] Generation assets saved:', generationAssets.length);
          }
        } catch (assetError) {
          console.error('[Webhook] Asset processing error:', assetError);
        }
      }

    } else if (payload.status === "failed") {
      const { error } = await supabase
        .from('event_log')
        .insert({
          ...baseEvent,
          ext_id: `${payload.id}-failed-${Date.now()}`,
          event_type: 'failed',
          error_message: 'Generation failed'
        });
        
      if (error) {
        console.error('[Webhook] Failed to save failed event:', error);
      } else {
        console.log('[Webhook] Failed event saved:', { jobId });
      }
    }

    console.log('[Webhook] Event processed successfully:', payload.id);

  } catch (error) {
    console.error('[Webhook] Processing error:', error);
  }
}

// This function is now replaced by direct query to imagine_task_map table
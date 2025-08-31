// ImagineAPI Webhook受信エンドポイント - 修正版
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// 正しいImagineAPI Webhook構造
type ImagineWebhook =
  | {
      request: "imagine.image.update";
      status: "queued" | "in-progress";
      id: string;
      prompt?: string;
      progress?: number;
      url?: string; // in-progressでのプレビュー画像
      result?: undefined;
      error?: string | null;
    }
  | {
      request: "imagine.image.update";
      status: "completed";
      id: string;
      prompt?: string;
      result: {
        urls: string[];
        upscaled_urls?: string[];
      };
      error?: null;
    }
  | {
      request: "imagine.image.update";
      status: "failed";
      id: string;
      error: string;
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
    body: req.body
  });
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const evt = req.body as ImagineWebhook;
    
    // 即座に200レスポンス
    res.status(200).json({ success: true });
    
    // 非同期処理
    processImagineWebhook(evt);
    
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ error: 'Webhook error' });
  }
}

async function processImagineWebhook(evt: ImagineWebhook) {
  try {
    console.log('[Webhook] Processing event:', {
      id: evt.id,
      status: evt.status,
      progress: evt.status === 'in-progress' ? (evt as any).progress : undefined,
      hasResult: !!(evt as any).result
    });

    // 1) task_id => job_id の対応を取得（imagine_task_mapから）
    const { data: mapping } = await supabase
      .from('imagine_task_map')
      .select('job_id')
      .eq('task_id', evt.id)
      .maybeSingle();
    
    if (!mapping?.job_id) {
      console.warn('[Webhook] No job_id mapping found for task_id:', evt.id);
      return;
    }
    
    const jobId = mapping.job_id;
    console.log('[Webhook] Found job_id:', jobId, 'for task_id:', evt.id);

    // 2) event_logに正規化して保存（カラムを個別に設定）
    const baseEvent = {
      job_id: jobId,
      image_id: evt.id,
      payload: evt,
      created_at: new Date().toISOString(),
      processed: false
    };

    if (evt.status === "in-progress") {
      const { error } = await supabase
        .from('event_log')
        .insert({
          ...baseEvent,
          ext_id: `${evt.id}-progress-${Date.now()}`,
          event_type: 'progress',
          progress: evt.progress || null,
          preview_url: evt.url || null
        });
        
      if (error) {
        console.error('[Webhook] Failed to save progress event:', error);
      } else {
        console.log('[Webhook] Progress event saved:', { jobId, progress: evt.progress });
      }

    } else if (evt.status === "completed" && (evt as any).result) {
      const result = (evt as any).result;
      const { error } = await supabase
        .from('event_log')
        .insert({
          ...baseEvent,
          ext_id: `${evt.id}-completed-${Date.now()}`,
          event_type: 'completed',
          result_urls: result.urls || [],
          upscaled_urls: result.upscaled_urls || null
        });
        
      if (error) {
        console.error('[Webhook] Failed to save completed event:', error);
      } else {
        console.log('[Webhook] Completed event saved:', { 
          jobId, 
          urls: result.urls?.length || 0,
          upscaled: result.upscaled_urls?.length || 0
        });
      }

    } else if (evt.status === "failed") {
      const { error } = await supabase
        .from('event_log')
        .insert({
          ...baseEvent,
          ext_id: `${evt.id}-failed-${Date.now()}`,
          event_type: 'failed',
          error_message: evt.error || null
        });
        
      if (error) {
        console.error('[Webhook] Failed to save failed event:', error);
      } else {
        console.log('[Webhook] Failed event saved:', { jobId, error: evt.error });
      }
    }

    console.log('[Webhook] Event processed successfully:', evt.id);

  } catch (error) {
    console.error('[Webhook] Processing error:', error);
  }
}

// This function is now replaced by direct query to imagine_task_map table
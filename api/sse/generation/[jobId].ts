// Edge Runtime SSE endpoint - KV対応版
import type { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  // URLからjobIdを取得
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const encodedJobId = pathParts[pathParts.length - 1];
  const jobId = decodeURIComponent(encodedJobId);

  console.log('[SSE Edge] Starting connection for job:', jobId);

  const encoder = new TextEncoder();

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error("SSE send error:", e);
        }
      };

      try {
        // 接続確認メッセージ
        send("connected", { 
          jobId, 
          timestamp: Date.now(),
          message: "Connected to generation stream"
        });
      } catch (e) {
        console.error("SSE start error:", e);
        controller.error(e);
        return;
      }

      // Keep-alive ping (15秒ごと)
      const pingInterval = setInterval(() => {
        try {
          send("ping", { 
            timestamp: Date.now(),
            jobId 
          });
        } catch (e) {
          console.error("Ping error:", e);
        }
      }, 15000);

      // Get image_id from task mapping for polling
      let imageIdForPolling = null;
      try {
        const supabaseForMapping = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        );
        
        const { data: taskMapping } = await supabaseForMapping
          .from('imagine_task_map')
          .select('task_id')
          .eq('job_id', jobId)
          .maybeSingle();
        
        if (taskMapping?.task_id) {
          imageIdForPolling = taskMapping.task_id;
          console.log('[SSE Edge] Found image_id for polling:', imageIdForPolling);
        }
      } catch (e) {
        console.log('[SSE Edge] Could not get image_id for polling:', e);
      }

      // KVまたはDBからのポーリング
      let lastEventIndex = 0;
      let lastEventId = 0; // DB event_log.id の増分管理
      let completed = false;
      
      // Also poll ImagineAPI directly if we have image_id (as fallback)
      let pollingAttempts = 0;
      const maxPollingAttempts = 60; // 5 minutes max
      
      const pollInterval = setInterval(async () => {
        if (completed) return;
        
        try {
          // Poll ImagineAPI directly if we have image_id - more aggressive polling
          if (imageIdForPolling && pollingAttempts < maxPollingAttempts) {
            pollingAttempts++;
            
            try {
              // Direct ImagineAPI polling
              const directResponse = await fetch(`https://cl.imagineapi.dev/items/images/${imageIdForPolling}`, {
                headers: {
                  'Authorization': `Bearer imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos`
                }
              });
              
              if (directResponse.ok) {
                const directData = await directResponse.json();
                console.log('[SSE Edge] Direct API polling:', directData.status, 'progress:', directData.progress);
                
                // If completed, immediately process the result
                if (directData.status === 'completed' && directData.upscaled_urls && directData.upscaled_urls.length > 0) {
                  console.log('[SSE Edge] Found completion via direct polling, processing immediately');
                  
                  const assets = directData.upscaled_urls.map((url: string, index: number) => ({
                    id: `${directData.id}_${index + 1}`,
                    r2_url: url,
                    width: 1024,
                    height: 1024,
                    imagine_image_index: index + 1
                  }));
                  
                  send("completed", {
                    jobId,
                    status: "completed",
                    progress: 100,
                    message: "Generation completed (direct polling)",
                    assets
                  });
                  
                  completed = true;
                  
                  setTimeout(() => {
                    clearInterval(pingInterval);
                    clearInterval(pollInterval);
                    controller.close();
                  }, 1000);
                  
                  return; // Skip other polling methods
                } else if (directData.progress) {
                  // Send progress update
                  send("progress", {
                    jobId,
                    progress: directData.progress,
                    message: `Generating... ${directData.progress}%`
                  });
                }
              }
            } catch (pollError) {
              console.error('[SSE Edge] Direct polling error:', pollError);
            }
            
            // Fallback: Use our status endpoint
            try {
              const statusUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://open-wardrobe-market.vercel.app'}/api/imagine-status?imageId=${imageIdForPolling}&jobId=${jobId}`;
              const statusResponse = await fetch(statusUrl);
              
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('[SSE Edge] Fallback polling status:', statusData.status);
              }
            } catch (fallbackError) {
              console.error('[SSE Edge] Fallback polling error:', fallbackError);
            }
          }
          
          // KVが設定されている場合
          if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            try {
              // KVからイベントリストを取得
              const key = `job:${jobId}:events`;
              const events = await kv.lrange(key, lastEventIndex, -1);
              
              if (events && events.length > 0) {
                for (const eventStr of events) {
                  try {
                    const eventData = typeof eventStr === 'string' 
                      ? JSON.parse(eventStr) 
                      : eventStr;
                    
                    // イベントタイプに応じて送信
                    if (eventData.kind === 'progress') {
                      send("progress", {
                        jobId,
                        progress: eventData.progress || 0,
                        message: eventData.message || `Generating... ${eventData.progress || 0}%`
                      });
                    } else if (eventData.kind === 'completed') {
                      send("completed", {
                        jobId,
                        status: "completed",
                        progress: 100,
                        message: eventData.message || "Generation completed",
                        assets: eventData.assets || []
                      });
                      completed = true;
                      
                      // 完了後2秒でクローズ
                      setTimeout(() => {
                        clearInterval(pingInterval);
                        clearInterval(pollInterval);
                        controller.close();
                      }, 2000);
                    } else if (eventData.kind === 'failed') {
                      send("failed", {
                        jobId,
                        status: "failed",
                        progress: 0,
                        message: eventData.message || "Generation failed",
                        error: eventData.error
                      });
                      completed = true;
                      
                      // 失敗後2秒でクローズ
                      setTimeout(() => {
                        clearInterval(pingInterval);
                        clearInterval(pollInterval);
                        controller.close();
                      }, 2000);
                    }
                    
                    lastEventIndex++;
                  } catch (parseError) {
                    console.error("Event parse error:", parseError);
                  }
                }
              }
            } catch (kvError) {
              console.error("KV polling error:", kvError);
              // KVエラーの場合はDBにフォールバック
            }
          }
          
          // Supabaseから新しいWebhookイベントを取得（job_id列検索）
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

          const { data: newEvents } = await supabase
            .from('event_log')
            .select('*')
            .eq('job_id', jobId)
            .in('event_type', ['progress', 'completed', 'failed'])
            .gt('id', lastEventId)
            .order('id', { ascending: true });

          if (newEvents && newEvents.length > 0) {
            for (const event of newEvents) {
              const eventData = event.payload;
              
              if (event.event_type === 'progress') {
                send("progress", {
                  jobId,
                  progress: event.progress || eventData.progress || 0,
                  preview_url: event.preview_url || eventData.url || null,
                  message: `Generating... ${event.progress || eventData.progress || 0}%`
                });
              } else if (event.event_type === 'completed') {
                // result_urlsカラムから画像アセットを構築（新しいスキーマ）
                const urls = event.result_urls || eventData.result?.urls || [];
                const assets = urls.map((url: string, index: number) => ({
                  id: `${event.image_id || eventData.id}_${index + 1}`,
                  r2_url: url,
                  width: 1024,
                  height: 1024,
                  imagine_image_index: index + 1
                }));
                
                send("completed", {
                  jobId,
                  status: "completed",
                  progress: 100,
                  message: "Generation completed",
                  assets
                });
                completed = true;
                
                setTimeout(() => {
                  clearInterval(pingInterval);
                  clearInterval(pollInterval);
                  controller.close();
                }, 2000);
              } else if (event.event_type === 'failed') {
                send("failed", {
                  jobId,
                  status: "failed",
                  progress: 0,
                  message: eventData.error || "Generation failed",
                  error: eventData.error
                });
                completed = true;
                
                setTimeout(() => {
                  clearInterval(pingInterval);
                  clearInterval(pollInterval);
                  controller.close();
                }, 2000);
              }

              // lastEventId更新（processedフラグは不要）
              lastEventId = event.id;
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 500); // 0.5秒ごとにポーリング - より高速な応答

      // クリーンアップ処理
      const onAbort = () => {
        console.log('[SSE Edge] Cleaning up for job:', jobId);
        clearInterval(pingInterval);
        clearInterval(pollInterval);
        try { 
          controller.close(); 
        } catch (e) {
          console.error("Close error:", e);
        }
      };

      // 接続切断の監視
      req.signal.addEventListener("abort", onAbort);
    },

    cancel() {
      console.log('[SSE Edge] Stream cancelled for job:', jobId);
    }
  });

  return new Response(stream, { headers });
}
// SSE Endpoint - Upstash Redis対応Edge Runtime版
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const jobId = decodeURIComponent(params.jobId);
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

      // 接続確認
      send("connected", { 
        jobId, 
        timestamp: Date.now(),
        message: "Connected to generation stream"
      });

      // Keep-alive ping
      const pingInterval = setInterval(() => {
        try {
          send("ping", { timestamp: Date.now(), jobId });
        } catch (e) {
          console.error("Ping error:", e);
        }
      }, 15000);

      // Redis Pub/Subからのメッセージ取得（ロングポーリング）
      let completed = false;
      const pollRedis = async () => {
        while (!completed && !request.signal.aborted) {
          try {
            if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
              // Redisからチャンネルのメッセージを取得
              const response = await fetch(
                `${process.env.UPSTASH_REDIS_REST_URL}/get/job:${jobId}:latest`,
                {
                  headers: { 
                    Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` 
                  },
                  cache: "no-store"
                }
              );

              if (response.ok) {
                const result = await response.json();
                if (result.result) {
                  const eventData = typeof result.result === 'string' 
                    ? JSON.parse(result.result) 
                    : result.result;

                  // イベントタイプに応じて送信
                  if (eventData.kind === 'generation.progress') {
                    send("progress", {
                      jobId,
                      progress: eventData.progress || 0,
                      message: `Generating... ${eventData.progress || 0}%`
                    });
                  } else if (eventData.kind === 'generation.completed') {
                    send("completed", {
                      jobId,
                      status: "completed",
                      progress: 100,
                      message: "Generation completed",
                      assets: eventData.images?.map((img: any, idx: number) => ({
                        id: `${jobId}_${idx + 1}`,
                        r2_url: img.url,
                        imagine_image_index: idx + 1
                      })) || []
                    });
                    completed = true;
                    
                    // 完了後クローズ
                    setTimeout(() => {
                      clearInterval(pingInterval);
                      controller.close();
                    }, 2000);
                  } else if (eventData.kind === 'generation.failed') {
                    send("failed", {
                      jobId,
                      status: "failed",
                      progress: 0,
                      message: eventData.error?.message || "Generation failed",
                      error: eventData.error?.message
                    });
                    completed = true;
                    
                    // 失敗後クローズ
                    setTimeout(() => {
                      clearInterval(pingInterval);
                      controller.close();
                    }, 2000);
                  }

                  // 処理済みメッセージを削除
                  await fetch(
                    `${process.env.UPSTASH_REDIS_REST_URL}/del/job:${jobId}:latest`,
                    {
                      method: "POST",
                      headers: { 
                        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` 
                      }
                    }
                  );
                }
              }
            }
          } catch (error) {
            console.error("Redis polling error:", error);
          }

          // 1秒待機
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      };

      // Redis ポーリング開始
      pollRedis();

      // クリーンアップ
      const onAbort = () => {
        console.log('[SSE Edge] Cleaning up for job:', jobId);
        completed = true;
        clearInterval(pingInterval);
        try { 
          controller.close(); 
        } catch (e) {
          console.error("Close error:", e);
        }
      };

      request.signal.addEventListener("abort", onAbort);
    },

    cancel() {
      console.log('[SSE Edge] Stream cancelled');
    }
  });

  return new Response(stream, { headers });
}
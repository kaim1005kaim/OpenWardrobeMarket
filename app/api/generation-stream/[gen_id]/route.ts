export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * SSE endpoint for real-time variant updates
 * Client connects to: /api/generation-stream/{gen_id}
 * Events: variant, complete, error
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { gen_id: string } }
) {
  const genId = params.gen_id;

  if (!genId) {
    return new Response('Missing gen_id', { status: 400 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Helper to send SSE message
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendEvent('connected', { gen_id: genId });

      // Subscribe to Supabase Realtime changes
      const channel = supabase
        .channel(`generation:${genId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'generation_history',
            filter: `id=eq.${genId}`
          },
          (payload) => {
            console.log('[generation-stream] Update received:', payload);

            const newRecord = payload.new as any;
            const variants = newRecord.metadata?.variants || [];

            // Check for new completed variants
            variants.forEach((variant: any) => {
              if (variant.status === 'completed') {
                sendEvent('variant', {
                  type: variant.type,
                  r2_url: variant.r2_url,
                  created_at: variant.created_at
                });
              } else if (variant.status === 'failed') {
                sendEvent('error', {
                  type: variant.type,
                  error: variant.error || 'Generation failed'
                });
              }
            });

            // Check if all variants are done
            const sideVariant = variants.find((v: any) => v.type === 'side');
            const backVariant = variants.find((v: any) => v.type === 'back');

            if (
              sideVariant?.status === 'completed' &&
              backVariant?.status === 'completed'
            ) {
              sendEvent('complete', {
                message: 'All variants generated',
                variants
              });
            }
          }
        )
        .subscribe();

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        console.log('[generation-stream] Client disconnected');
        clearInterval(heartbeatInterval);
        channel.unsubscribe();
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

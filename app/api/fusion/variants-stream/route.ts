/**
 * SSE Stream for Variant Generation Progress
 * Client connects to receive real-time updates as SIDE/BACK variants are generated
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// In-memory event emitter for SSE
const activeStreams = new Map<string, ReadableStreamDefaultController>();

/**
 * Emit event to specific generation stream
 */
export function emitVariantProgress(genId: string, data: any) {
  const controller = activeStreams.get(genId);
  if (controller) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  }
}

/**
 * SSE endpoint: GET /api/fusion/variants-stream?genId=xxx
 */
export async function GET(req: NextRequest) {
  const genId = req.nextUrl.searchParams.get('genId');

  if (!genId) {
    return new Response('Missing genId parameter', { status: 400 });
  }

  console.log(`[variants-stream] Client connected for ${genId}`);

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Register controller
      activeStreams.set(genId, controller);

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({ type: 'connected', genId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialMessage));

      // Send current state from database
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      supabase
        .from('generation_history')
        .select('variants')
        .eq('id', genId)
        .single()
        .then(({ data }) => {
          if (data?.variants) {
            const message = `data: ${JSON.stringify({ type: 'initial_state', variants: data.variants })}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
          }
        })
        .catch(err => console.error('[variants-stream] Error fetching initial state:', err));

      // Keep-alive ping every 15 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch (err) {
          clearInterval(keepAlive);
        }
      }, 15000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        console.log(`[variants-stream] Client disconnected for ${genId}`);
        clearInterval(keepAlive);
        activeStreams.delete(genId);
        try {
          controller.close();
        } catch (err) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

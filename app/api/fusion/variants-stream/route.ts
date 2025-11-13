/**
 * SSE Stream for Variant Generation Progress (Notification-Only)
 * Polls database and streams updates - does NOT perform generation
 * Auto-closes after 90 seconds to avoid timeout
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max (safety buffer)

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { activeStreams } from 'lib/sse-emitter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_DURATION_MS = 90000; // Auto-close after 90 seconds

export async function GET(req: NextRequest) {
  const genId = req.nextUrl.searchParams.get('genId');

  if (!genId) {
    return new Response('Missing genId parameter', { status: 400 });
  }

  console.log(`[variants-stream] Client connected for ${genId}`);

  const stream = new ReadableStream({
    start(controller) {
      activeStreams.set(genId, controller);
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Send connection confirmation
      const initialMessage = `data: ${JSON.stringify({ type: 'connected', genId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialMessage));

      let lastVariantsState: any = null;
      const startTime = Date.now();

      // Poll database for variant updates
      const pollInterval = setInterval(async () => {
        try {
          // Check if exceeded max duration
          if (Date.now() - startTime > MAX_DURATION_MS) {
            console.log(`[variants-stream] Max duration reached for ${genId}, closing stream`);
            const timeoutMsg = `data: ${JSON.stringify({ type: 'timeout', message: 'Stream auto-closed after 90s' })}\n\n`;
            controller.enqueue(new TextEncoder().encode(timeoutMsg));
            clearInterval(pollInterval);
            clearInterval(keepAlive);
            activeStreams.delete(genId);
            controller.close();
            return;
          }

          // Fetch current variants state from generation_history
          const { data: genData } = await supabase
            .from('generation_history')
            .select('variants')
            .eq('id', genId)
            .single();

          const currentVariants = genData?.variants || [];

          // Check how many jobs are expected (count pending/processing/completed/failed jobs)
          const { data: jobs, error: jobsError } = await supabase
            .from('variants_jobs')
            .select('status')
            .eq('gen_id', genId);

          const expectedJobCount = jobs?.length || 2; // Default to 2 (side + back)

          // Send update if state changed
          if (JSON.stringify(currentVariants) !== JSON.stringify(lastVariantsState)) {
            console.log(`[variants-stream] Variants updated for ${genId}:`, currentVariants, `(${currentVariants.length}/${expectedJobCount})`);
            lastVariantsState = currentVariants;

            const message = `data: ${JSON.stringify({ type: 'variants_update', variants: currentVariants })}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));

            // Check if all variants completed or failed
            const allDone = currentVariants.every((v: any) =>
              v.status === 'completed' || v.status === 'failed'
            );

            // IMPORTANT: Only send all_complete when we have results for all expected jobs
            if (allDone && currentVariants.length >= expectedJobCount) {
              console.log(`[variants-stream] All variants completed for ${genId} (${currentVariants.length}/${expectedJobCount})`);
              const doneMsg = `data: ${JSON.stringify({ type: 'all_complete', variants: currentVariants })}\n\n`;
              controller.enqueue(new TextEncoder().encode(doneMsg));

              // Close stream after completion
              clearInterval(pollInterval);
              clearInterval(keepAlive);
              activeStreams.delete(genId);
              controller.close();
            }
          }
        } catch (err) {
          console.error('[variants-stream] Polling error:', err);
        }
      }, POLL_INTERVAL_MS);

      // Keep-alive ping
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch (err) {
          clearInterval(keepAlive);
          clearInterval(pollInterval);
        }
      }, 15000);

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        console.log(`[variants-stream] Client disconnected for ${genId}`);
        clearInterval(keepAlive);
        clearInterval(pollInterval);
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

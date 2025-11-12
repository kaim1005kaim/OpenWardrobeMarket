/**
 * SSE Event Emitter
 * Manages in-memory SSE connections for variant generation progress
 */

// In-memory event emitter for SSE
export const activeStreams = new Map<string, ReadableStreamDefaultController>();

/**
 * Emit event to specific generation stream
 */
export function emitVariantProgress(genId: string, data: any) {
  const controller = activeStreams.get(genId);
  if (controller) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (err) {
      console.error('[emitVariantProgress] Failed to enqueue:', err);
      // Remove dead stream
      activeStreams.delete(genId);
    }
  }
}

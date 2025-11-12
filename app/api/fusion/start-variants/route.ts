/**
 * Start Variant Generation (SIDE + BACK)
 * Orchestrates background generation and sends progress via SSE
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { VariantMetadata } from '../../../../src/types/garment-spec';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface StartVariantsRequest {
  genId: string;
  userId: string;
  views?: ('side' | 'back')[];
}

/**
 * Emit SSE event (imported dynamically to avoid circular dependency)
 */
async function emitProgress(genId: string, data: any) {
  try {
    // Import dynamically to avoid issues
    const { emitVariantProgress } = await import('../variants-stream/route');
    emitVariantProgress(genId, data);
  } catch (err) {
    console.error('[start-variants] Failed to emit progress:', err);
  }
}

/**
 * Generate single variant in background
 */
async function generateVariantBackground(
  genId: string,
  view: 'side' | 'back',
  userId: string
) {
  const apiUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173');

  console.log(`[start-variants] Starting ${view} generation for ${genId}`);

  // Update status to generating
  const { data: currentGen } = await supabase
    .from('generation_history')
    .select('variants')
    .eq('id', genId)
    .single();

  const variants: VariantMetadata[] = currentGen?.variants || [];
  const existingIdx = variants.findIndex(v => v.type === view);

  const pendingVariant: VariantMetadata = {
    type: view,
    r2_url: null,
    status: 'generating',
    tries: 0
  };

  if (existingIdx >= 0) {
    variants[existingIdx] = pendingVariant;
  } else {
    variants.push(pendingVariant);
  }

  await supabase
    .from('generation_history')
    .update({ variants })
    .eq('id', genId);

  // Emit SSE update
  await emitProgress(genId, {
    type: 'variant_update',
    view,
    status: 'generating',
    progress: 'Starting generation...'
  });

  try {
    // Call generate-variant API
    const response = await fetch(`${apiUrl}/api/fusion/generate-variant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genId, view, userId })
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.status}`);
    }

    const result = await response.json();

    console.log(`[start-variants] ${view} generation completed:`, result);

    // Emit success
    await emitProgress(genId, {
      type: 'variant_complete',
      view,
      variant: result.variant
    });

  } catch (error) {
    console.error(`[start-variants] ${view} generation failed:`, error);

    // Update to failed
    const failedVariant: VariantMetadata = {
      type: view,
      r2_url: null,
      status: 'failed',
      tries: 3,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    const { data: failedGen } = await supabase
      .from('generation_history')
      .select('variants')
      .eq('id', genId)
      .single();

    const failedVariants: VariantMetadata[] = failedGen?.variants || [];
    const failedIdx = failedVariants.findIndex(v => v.type === view);

    if (failedIdx >= 0) {
      failedVariants[failedIdx] = failedVariant;
    } else {
      failedVariants.push(failedVariant);
    }

    await supabase
      .from('generation_history')
      .update({ variants: failedVariants })
      .eq('id', genId);

    // Emit failure
    await emitProgress(genId, {
      type: 'variant_failed',
      view,
      error: failedVariant.error
    });
  }
}

/**
 * POST /api/fusion/start-variants
 * Kicks off background generation for SIDE and BACK views
 */
export async function POST(req: NextRequest) {
  try {
    const body: StartVariantsRequest = await req.json();
    const { genId, userId, views = ['side', 'back'] } = body;

    if (!genId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: genId, userId' },
        { status: 400 }
      );
    }

    console.log(`[start-variants] Starting variants for ${genId}:`, views);

    // Initialize variants array in database
    const initialVariants: VariantMetadata[] = views.map(view => ({
      type: view,
      r2_url: null,
      status: 'pending',
      tries: 0
    }));

    await supabase
      .from('generation_history')
      .update({ variants: initialVariants })
      .eq('id', genId);

    // Start background generation (don't await - let it run)
    // Generate in sequence to avoid quota issues
    (async () => {
      for (const view of views) {
        await generateVariantBackground(genId, view, userId);
      }

      // Emit completion
      await emitProgress(genId, {
        type: 'all_complete'
      });
    })();

    return NextResponse.json({
      success: true,
      message: 'Variant generation started',
      genId,
      views
    });

  } catch (error) {
    console.error('[start-variants] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

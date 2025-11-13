/**
 * Start Variant Generation (SIDE + BACK)
 * Creates variant generation jobs in database - returns immediately
 * Actual generation is triggered by client calling /api/fusion/variants-generate
 */

export const maxDuration = 10; // Fast job registration only

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface StartVariantsRequest {
  genId: string;
  userId: string;
  views?: ('side' | 'back')[];
}

/**
 * POST /api/fusion/start-variants
 * Creates variant generation jobs and returns immediately
 * Does NOT perform actual generation (client will call variants-generate)
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

    console.log(`[start-variants] Creating jobs for ${genId}:`, views);

    // Fetch base generation data
    const { data: genData, error: genError } = await supabase
      .from('generation_history')
      .select('prompt, r2_key, seed_main, metadata, design_tokens, demographic')
      .eq('id', genId)
      .single();

    if (genError || !genData) {
      console.error('[start-variants] Generation not found:', genError);
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    const baseDna = genData.metadata?.dna || null;
    const baseSeed = genData.seed_main || Math.floor(Math.random() * 1000000);

    // Create variant jobs
    const jobs = views.map(view => ({
      gen_id: genId,
      type: view,
      status: 'pending',
      base_prompt: genData.prompt,
      base_r2_key: genData.r2_key,
      base_seed: baseSeed,
      base_dna: baseDna,
      demographic: genData.demographic || genData.metadata?.demographic || 'Unisex',
      design_tokens: genData.design_tokens || null,
      attempts: 0
    }));

    const { data: insertedJobs, error: insertError } = await supabase
      .from('variants_jobs')
      .insert(jobs)
      .select('id, type, status');

    if (insertError) {
      console.error('[start-variants] Failed to create jobs:', insertError);
      return NextResponse.json(
        { error: 'Failed to create variant jobs' },
        { status: 500 }
      );
    }

    console.log(`[start-variants] ✅ Created ${insertedJobs.length} jobs:`, insertedJobs);

    return NextResponse.json({
      success: true,
      message: 'Variant jobs created',
      genId,
      jobs: insertedJobs
    });

  } catch (error) {
    console.error('[start-variants] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

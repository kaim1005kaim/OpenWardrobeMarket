/**
 * Generate Single Variant (SIDE or BACK)
 * Processes one variant job at a time - avoids timeout
 * Called by client for each pending job
 */

export const maxDuration = 120; // 2 minutes per variant (enough for 1 generation + validation)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callVertexAIImagen } from 'lib/vertex-ai-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { DesignTokens } from '../../../../src/types/garment-spec';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const r2Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

/**
 * Build FUSION-aware variant prompt
 * Uses base generation data to ensure "same garment, different view"
 */
function buildFusionVariantPrompt(
  tokens: DesignTokens,
  basePrompt: string,
  view: 'side' | 'back',
  demographic: string
): { prompt: string; negativePrompt: string } {
  // View-specific instructions
  const viewInstructions = view === 'side'
    ? `SIDE VIEW (90° profile): strict side angle, torso perpendicular to camera.
Face NOT visible from front. Show: side seam, sleeve construction, garment depth.`
    : `BACK VIEW (180°): model facing completely away, shoulders square to camera.
NO face visible. Show: full back silhouette, back seamlines, rear construction.`;

  // Color palette
  const colorDesc = tokens.palette_hex
    .map((hex, i) => `${hex} ${Math.round(100 / tokens.palette_hex.length)}%`)
    .join(', ');

  // Invariant details
  const detailsDesc = tokens.invariant_details.length > 0
    ? `\nCRITICAL DETAILS (MUST appear in ${view} view):\n- ${tokens.invariant_details.join('\n- ')}`
    : '';

  const prompt = `FASHION EDITORIAL, 3:4 vertical composition, product-forward photography.

${viewInstructions}

GARMENT IDENTITY (same as main image):
Type: ${tokens.garment_type}
Silhouette: ${tokens.silhouette}
Length: ${tokens.length}
Neckline: ${tokens.neckline}
Sleeve: ${tokens.sleeve}

MATERIALS: ${tokens.materials.join(', ')}
High-quality fabric texture, editorial finishing.

COLOR PALETTE (exact colors from main image):
${colorDesc}
${detailsDesc}

TRIM/FINISHING: ${tokens.trim.join(', ')}

LIGHTING: Soft editorial lighting, high CRI, subtle highlights.

CAMERA: 50-85mm focal length, ${view === 'side' ? '90° side' : '180° back'} angle, editorial fashion.

MODEL: ${demographic}, minimal styling, professional pose showcasing garment from ${view} view.

BACKGROUND: Clean studio, minimal, high-end editorial (same as main image).

CRITICAL CONSISTENCY REQUIREMENTS:
- This is exactly the same garment as the main front view
- Same colors, same materials, same silhouette, same details
- Only the camera angle has changed (rotated to ${view} view)
- Do not change the outfit concept or design
- Keep lighting and background consistent with main image

ABSTRACT CONSTRUCTION LANGUAGE ONLY:
- Seams, panels, pleats, quilting, piping, appliqués
- NO logos, NO text, NO cultural symbols, NO literal objects`;

  const negativePrompt = view === 'side'
    ? 'front view, frontal pose, face looking at camera, forward facing, three-quarter view, both eyes visible, frontal chest, different outfit, different colorway, different silhouette, missing details, busy background'
    : 'front view, frontal pose, face visible, side view, profile view, eyes, nose, mouth, frontal torso, three-quarter back, different outfit, different colorway, different silhouette, missing details, busy background';

  return { prompt, negativePrompt };
}

/**
 * Upload image to R2
 */
async function uploadToR2(
  base64Image: string,
  genId: string,
  view: 'side' | 'back'
): Promise<{ key: string; url: string }> {
  const imageBuffer = Buffer.from(base64Image, 'base64');
  const timestamp = Date.now();
  const key = `generations/fusion-variants/${genId}/${view}_${timestamp}.jpg`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    })
  );

  const url = `https://owm-assets.kaim.me/${key}`;
  return { key, url };
}

/**
 * Emit SSE progress update
 */
async function emitProgress(genId: string, data: any) {
  try {
    const { emitVariantProgress } = await import('lib/sse-emitter');
    emitVariantProgress(genId, data);
  } catch (err) {
    console.error('[variants-generate] Failed to emit progress:', err);
  }
}

/**
 * POST /api/fusion/variants-generate
 * Generate one variant based on job_id
 */
export async function POST(req: NextRequest) {
  try {
    const { job_id } = await req.json();

    if (!job_id) {
      return NextResponse.json(
        { error: 'Missing required field: job_id' },
        { status: 400 }
      );
    }

    console.log(`[variants-generate] Processing job ${job_id}`);

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from('variants_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'pending') {
      return NextResponse.json(
        { error: `Job already ${job.status}` },
        { status: 400 }
      );
    }

    // Mark as processing
    await supabase
      .from('variants_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job_id);

    await emitProgress(job.gen_id, {
      type: 'variant_update',
      view: job.type,
      status: 'generating',
      progress: 'Starting generation...'
    });

    // Get design tokens from job, or fetch from generation_history if not available
    let tokens: DesignTokens = job.design_tokens;

    if (!tokens) {
      console.log(`[variants-generate] design_tokens not in job, fetching from generation_history...`);
      const { data: genData, error: genError } = await supabase
        .from('generation_history')
        .select('design_tokens')
        .eq('id', job.gen_id)
        .single();

      if (genError || !genData?.design_tokens) {
        throw new Error('Design tokens not found. Run extract-tokens first.');
      }

      tokens = genData.design_tokens;
      console.log(`[variants-generate] ✅ Fetched design_tokens from generation_history`);
    }

    // Build prompt
    const { prompt, negativePrompt } = buildFusionVariantPrompt(
      tokens,
      job.base_prompt,
      job.type,
      job.demographic
    );

    console.log(`[variants-generate] Generating ${job.type} with Imagen 3...`);

    // Generate with Imagen 3
    // Use deterministic seed: base_seed + offset (side=+1, back=+2)
    const seedOffset = job.type === 'side' ? 1 : 2;
    const variantSeed = job.base_seed + seedOffset;

    const result = await callVertexAIImagen(
      'imagen-3.0-generate-002',
      prompt,
      {
        sampleCount: 1,
        aspectRatio: '3:4',
        negativePrompt,
        guidanceScale: 40, // Strong guidance for consistency
        seed: variantSeed,
        addWatermark: false
      },
      { timeout: 90000 } // 90 seconds timeout
    );

    if (!result?.predictions?.[0]?.bytesBase64Encoded) {
      throw new Error('No image in Imagen response');
    }

    const base64Image = result.predictions[0].bytesBase64Encoded;

    // Upload to R2
    const { key, url } = await uploadToR2(base64Image, job.gen_id, job.type);
    console.log(`[variants-generate] Uploaded ${job.type}: ${url}`);

    // Update job to completed
    await supabase
      .from('variants_jobs')
      .update({
        status: 'completed',
        r2_key: key,
        r2_url: url,
        completed_at: new Date().toISOString(),
        attempts: job.attempts + 1
      })
      .eq('id', job_id);

    // Update generation_history variants array
    const { data: genData } = await supabase
      .from('generation_history')
      .select('variants')
      .eq('id', job.gen_id)
      .single();

    const variants = genData?.variants || [];
    const existingIdx = variants.findIndex((v: any) => v.type === job.type);

    const variantMeta = {
      type: job.type,
      r2_url: url,
      status: 'completed',
      tries: job.attempts + 1
    };

    if (existingIdx >= 0) {
      variants[existingIdx] = variantMeta;
    } else {
      variants.push(variantMeta);
    }

    await supabase
      .from('generation_history')
      .update({ variants })
      .eq('id', job.gen_id);

    // Emit success
    await emitProgress(job.gen_id, {
      type: 'variant_complete',
      view: job.type,
      variant: variantMeta
    });

    console.log(`[variants-generate] ✅ Completed ${job.type} for ${job.gen_id}`);

    return NextResponse.json({
      success: true,
      job_id,
      view: job.type,
      url,
      variant: variantMeta
    });

  } catch (error) {
    console.error('[variants-generate] Error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

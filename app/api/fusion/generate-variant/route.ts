/**
 * Generate SIDE/BACK variant with same-garment consistency
 * Uses DesignTokens + seed to maintain identical garment
 */

export const maxDuration = 300; // 5 minutes for retries

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callVertexAIImagen } from '../../../../../lib/vertex-ai-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { DesignTokens, VariantMetadata } from '../../../../src/types/garment-spec';
import type { ViewValidation } from '../../../../src/types/garment-spec';
import { isSameDesign } from '../../../../../lib/similarity-check';

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

const MAX_ATTEMPTS = 3;
const SIMILARITY_THRESHOLD = 0.7;
const VIEW_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Build prompt for SIDE/BACK using DesignTokens
 */
function buildVariantPrompt(
  tokens: DesignTokens,
  view: 'side' | 'back',
  attemptNumber: number
): { prompt: string; negativePrompt: string } {
  // Color palette with percentages (distribute evenly if no specific percentages)
  const totalColors = tokens.palette_hex.length;
  const colorDesc = tokens.palette_hex
    .map((hex, i) => `${hex} ${Math.round(100 / totalColors)}%`)
    .join(', ');

  // View instructions
  const viewInstructions = view === 'side'
    ? `SIDE VIEW (90° profile): strict side angle, torso perpendicular to camera, only ONE eye line implied.
Face NOT visible from front. No frontal features. No facing camera.
Show: side seam, sleeve construction from side, garment depth and layering.`
    : `BACK VIEW (180°): model facing completely away, shoulders square to camera, head down or neutral.
NO face visible at all. Show: full back silhouette, back seamlines, rear construction, back hemline.`;

  // Invariant details as CRITICAL requirements
  const detailsDesc = tokens.invariant_details.length > 0
    ? `\nCRITICAL INVARIANT DETAILS (MUST appear in ${view} view):\n- ${tokens.invariant_details.join('\n- ')}`
    : '';

  const seamDesc = tokens.seam_map.length > 0
    ? `\nSEAM/PANEL STRUCTURE (continue to ${view}):\n- ${tokens.seam_map.join('\n- ')}`
    : '';

  const gradDesc = tokens.gradations.length > 0
    ? `\nGRADATIONS/FINISHES:\n- ${tokens.gradations.join('\n- ')}`
    : '';

  // Background
  const bgDesc = tokens.bg_style === 'studio'
    ? 'Clean studio background, minimal, high-end editorial'
    : tokens.bg_style === 'color'
    ? 'Solid color background, complementary to garment palette'
    : 'Subtle gradient background, soft editorial tonality';

  const prompt = `FASHION EDITORIAL, 3:4 vertical composition, product-forward photography.

${viewInstructions}

GARMENT IDENTITY (CRITICAL - maintain from main image):
Type: ${tokens.garment_type}
Silhouette: ${tokens.silhouette}
Length: ${tokens.length}
Neckline: ${tokens.neckline}
Sleeve: ${tokens.sleeve}

MATERIALS: ${tokens.materials.join(', ')}
High-quality fabric texture, editorial finishing.

COLOR PALETTE (exact colors):
${colorDesc}
Apply these exact colors with editorial tonality.
${detailsDesc}
${seamDesc}
${gradDesc}

TRIM/FINISHING: ${tokens.trim.join(', ')}

LIGHTING: Soft editorial lighting, high CRI, subtle specular highlights revealing fabric texture and construction.

CAMERA: 50-85mm focal length, ${view === 'side' ? '90° side' : '180° back'} angle, eye-level, editorial fashion style.

MODEL: ${tokens.demographic}, minimal styling, neutral expression, professional pose showcasing garment from ${view} view.

BACKGROUND: ${bgDesc}

QUALITY: High resolution, editorial fashion photography standard, impeccable tailoring visible.

ABSTRACT CONSTRUCTION LANGUAGE ONLY:
- Seams, panels, pleats, quilting, piping, appliqués
- NO logos, NO text, NO cultural symbols, NO literal objects
- Only abstract geometric and construction-based design`;

  // Strong negative prompts
  let negativePrompt = view === 'side'
    ? 'front view, frontal pose, face looking at camera, forward facing, three-quarter view, frontal angle, both eyes visible, nose from front, face toward camera, frontal chest'
    : 'front view, frontal pose, face visible, side view, profile view, face looking at camera, forward facing, eyes, nose, mouth, frontal torso, three-quarter back';

  // Strengthen for retries
  if (attemptNumber > 1) {
    negativePrompt += ', different outfit, different colorway, different silhouette, missing details, added patterns, busy background';
  }

  if (attemptNumber > 2) {
    negativePrompt += ', hood up if should be down, jacket open if should be closed, altered construction, changed materials';
  }

  return { prompt, negativePrompt };
}

/**
 * Upload image to R2
 */
async function uploadToR2(
  base64Image: string,
  userId: string,
  genId: string,
  view: 'side' | 'back',
  attempt: number
): Promise<string> {
  const imageBuffer = Buffer.from(base64Image, 'base64');
  const timestamp = Date.now();
  const key = `generations/${userId}/${genId}/${view}_attempt${attempt}_${timestamp}.jpg`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    })
  );

  return `https://owm-assets.kaim.me/${key}`;
}

/**
 * Validate view using existing check-view API
 */
async function validateView(
  imageUrl: string,
  expectedView: 'side' | 'back'
): Promise<ViewValidation> {
  const apiUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173');

  const response = await fetch(`${apiUrl}/api/variants/check-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, expectedView })
  });

  if (!response.ok) {
    throw new Error(`View validation failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate variant with automatic retries and validation
 */
async function generateVariantWithValidation(
  tokens: DesignTokens,
  view: 'side' | 'back',
  userId: string,
  genId: string
): Promise<{ url: string; viewConf: number; simScore: number; attempts: number }> {

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[generate-variant] Attempt ${attempt}/${MAX_ATTEMPTS} for ${view}`);

    // Build prompt
    const { prompt, negativePrompt } = buildVariantPrompt(tokens, view, attempt);

    // Generate with Imagen 3
    const guidanceScale = 35 + (attempt * 5); // Increase guidance per attempt
    const seed = tokens.seed + (view === 'side' ? 1 : 2); // Deterministic offset from main seed

    try {
      const result = await callVertexAIImagen(
        'imagen-3.0-generate-002',
        prompt,
        {
          sampleCount: 1,
          aspectRatio: '3:4',
          negativePrompt,
          guidanceScale,
          seed,
          addWatermark: false
        },
        { timeout: 60000 }
      );

      if (!result?.predictions?.[0]?.bytesBase64Encoded) {
        throw new Error('No image in Imagen response');
      }

      const base64Image = result.predictions[0].bytesBase64Encoded;

      // Upload to R2
      const r2Url = await uploadToR2(base64Image, userId, genId, view, attempt);
      console.log(`[generate-variant] Uploaded ${view} attempt ${attempt}: ${r2Url}`);

      // Validate view
      const viewValidation = await validateView(r2Url, view);
      console.log(`[generate-variant] View validation:`, viewValidation);

      // Check similarity
      const similarityResult = await isSameDesign(tokens, r2Url, SIMILARITY_THRESHOLD);
      console.log(`[generate-variant] Similarity:`, similarityResult);

      // Both must pass
      if (viewValidation.ok && viewValidation.confidence >= VIEW_CONFIDENCE_THRESHOLD && similarityResult.ok) {
        console.log(`[generate-variant] SUCCESS on attempt ${attempt}`);
        return {
          url: r2Url,
          viewConf: viewValidation.confidence,
          simScore: similarityResult.score,
          attempts: attempt
        };
      }

      console.log(`[generate-variant] Attempt ${attempt} failed validation:`, {
        viewOk: viewValidation.ok,
        viewConf: viewValidation.confidence,
        simOk: similarityResult.ok,
        simScore: similarityResult.score
      });

    } catch (error) {
      console.error(`[generate-variant] Attempt ${attempt} error:`, error);
      if (attempt === MAX_ATTEMPTS) throw error;
    }
  }

  throw new Error(`Failed to generate valid ${view} after ${MAX_ATTEMPTS} attempts`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { genId, view, userId } = body as { genId: string; view: 'side' | 'back'; userId: string };

    if (!genId || !view || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: genId, view, userId' },
        { status: 400 }
      );
    }

    console.log(`[generate-variant] Starting ${view} generation for ${genId}`);

    // Fetch design tokens from generation_history
    const { data: genData, error: genError } = await supabase
      .from('generation_history')
      .select('design_tokens, seed_main, demographic')
      .eq('id', genId)
      .single();

    if (genError || !genData) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    const tokens: DesignTokens = genData.design_tokens;
    if (!tokens) {
      return NextResponse.json(
        { error: 'Design tokens not found. Run extract-tokens first.' },
        { status: 400 }
      );
    }

    // Generate with validation
    const result = await generateVariantWithValidation(tokens, view, userId, genId);

    // Update generation_history variants
    const variantMeta: VariantMetadata = {
      type: view,
      r2_url: result.url,
      status: 'completed',
      tries: result.attempts,
      view_conf: result.viewConf,
      sim_score: result.simScore
    };

    const { data: currentGen } = await supabase
      .from('generation_history')
      .select('variants')
      .eq('id', genId)
      .single();

    const variants = currentGen?.variants || [];
    const existingIdx = variants.findIndex((v: VariantMetadata) => v.type === view);

    if (existingIdx >= 0) {
      variants[existingIdx] = variantMeta;
    } else {
      variants.push(variantMeta);
    }

    await supabase
      .from('generation_history')
      .update({ variants })
      .eq('id', genId);

    return NextResponse.json({
      success: true,
      variant: variantMeta
    });

  } catch (error) {
    console.error('[generate-variant] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

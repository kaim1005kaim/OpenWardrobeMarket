export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callVertexAIImagen } from 'lib/vertex-ai-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { GarmentSpec, ViewType, ViewValidation } from '../../../../src/types/garment-spec';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const r2Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

type VariantType = 'side' | 'back';

const MAX_ATTEMPTS = 3;

/**
 * Build prompt for SIDE/BACK view with strict view enforcement
 */
function buildViewPrompt(
  spec: GarmentSpec,
  view: VariantType,
  attemptNumber: number
): { prompt: string; negativePrompt: string } {
  // Build garment description from spec
  const paletteDesc = spec.palette
    .map(c => `${c.hex} ${c.pct}%`)
    .join(', ');

  const motifsDesc = spec.motifs
    .map(m => {
      const op = m.operation || '';
      return `${op} at ${m.to} (${m.scale}, ${m.contrast})`;
    })
    .join('\n- ');

  // View-specific camera instructions
  const viewInstructions = view === 'side'
    ? `SIDE VIEW: strict profile, torso and head turned 90° relative to camera,
only one eye line implied, shoulders perpendicular to camera.
Face NOT visible from front, no frontal features, no facing camera.
Show side seam, sleeve construction from side, garment depth and layers.`
    : `BACK VIEW: model facing away from camera, shoulders square to camera,
head slightly down or neutral, no face visible.
Show full back silhouette, continue ${spec.detailing.join(', ')} at the back.
Back construction, rear seamlines, closures, back hemline clearly visible.`;

  // Stronger negative prompts for additional attempts
  let baseNegative = view === 'side'
    ? 'front view, frontal pose, face looking at camera, forward facing, three-quarter view, frontal angle, facing camera, both eyes visible, nose visible from front'
    : 'front view, frontal pose, face visible, side view, face looking at camera, forward facing, profile view, eyes, nose, mouth, frontal torso';

  if (attemptNumber > 1) {
    // Add extra prohibitions for retries
    baseNegative += view === 'side'
      ? ', no frontal chest, no both eyes, no nose from front, no face toward camera'
      : ', no face, no eyes, no nose, no mouth, no frontal body, no face from any angle';
  }

  const prompt = `FASHION EDITORIAL, 3:4 composition, product-forward photography.

${viewInstructions}

SAME GARMENT AS THE REFERENCE IMAGE:
Maintain identical colors, panels, trims, and volumes from reference.
Continue all design elements (${spec.detailing.join(', ')}) from front to ${view}.

SILHOUETTE: ${spec.silhouette}

MATERIALS: ${spec.materials.join(', ')}, luxurious fabric quality

PALETTE: ${paletteDesc}
Use these exact colors with soft, editorial tonality.

ABSTRACT DESIGN ELEMENTS (NO LITERAL OBJECTS):
- ${motifsDesc}

CONSTRUCTION DETAILS: ${spec.detailing.join(', ')}
${spec.construction.join(', ')}

LIGHTING: Soft editorial lighting, high CRI, subtle specular highlights to reveal fabric texture.

CAMERA: 50-85mm equivalent focal length, ${view === 'side' ? '90° side angle' : '180° back angle'}, fashion editorial style.

${spec.modelPhrase ? `MODEL: ${spec.modelPhrase}, minimal styling, neutral expression.` : 'NO visible model, garment-only composition, styled on invisible form.'}

${spec.background ? `BACKGROUND: ${spec.background}` : ''}

QUALITY: High resolution, editorial fashion photography standard, impeccable finishing visible.

CRITICAL: All design elements are abstract fashion operations only. NO literal objects, logos, text, or recognizable imagery.`;

  return {
    prompt,
    negativePrompt: baseNegative
  };
}

/**
 * Generate variant with retry logic and view validation
 */
async function generateVariantWithValidation(
  spec: GarmentSpec,
  mainImageUrl: string,
  view: VariantType,
  userId: string,
  genId: string
): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[variant] Attempt ${attempt}/${MAX_ATTEMPTS} for ${view} view...`);

    const { prompt, negativePrompt } = buildViewPrompt(spec, view, attempt);

    // Generate seed with attempt number to ensure different results
    const seed = Math.floor(Math.random() * 1000000) + attempt * 100000;

    console.log(`[variant] Prompt (${view}, attempt ${attempt}):`, prompt.slice(0, 300));
    console.log(`[variant] Negative:`, negativePrompt);

    try {
      // TODO: Add reference image support when Imagen 3 API supports it
      // For now, rely on very detailed garment spec repetition
      const data = await callVertexAIImagen(
        'imagen-3.0-generate-002',
        prompt,
        {
          sampleCount: 1,
          aspectRatio: '3:4',
          personGeneration: 'allow_adult',
          safetySetting: 'block_only_high',
          negativePrompt,
          guidanceScale: 35 + (attempt * 5) // Increase guidance for retries
        }
      );

      if (!data.predictions || data.predictions.length === 0) {
        throw new Error('No predictions returned from Imagen');
      }

      const imageData = data.predictions[0].bytesBase64Encoded;
      if (!imageData) {
        throw new Error('No image data in prediction');
      }

      // Upload to R2
      const r2Url = await uploadToR2(imageData, userId, genId, view, attempt);

      // Validate view
      console.log(`[variant] Validating ${view} view (attempt ${attempt})...`);
      const validationRes = await fetch(`${apiUrl}/api/variants/check-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: r2Url,
          expectedView: view
        })
      });

      const validation: ViewValidation = await validationRes.json();

      console.log(`[variant] Validation result:`, validation);

      if (validation.ok) {
        console.log(`[variant] ✅ ${view} view validated successfully (confidence: ${validation.confidence})`);
        return r2Url;
      }

      console.warn(`[variant] ⚠️ View validation failed (attempt ${attempt}):`, validation.reasons);

      if (attempt === MAX_ATTEMPTS) {
        console.warn(`[variant] Max attempts reached. Last image:`, r2Url);
        // Return last attempt even if not perfect
        return r2Url;
      }
    } catch (error) {
      console.error(`[variant] Error on attempt ${attempt}:`, error);
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to generate ${view} view after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Upload image to R2
 */
async function uploadToR2(
  imageData: string,
  userId: string,
  genId: string,
  view: VariantType,
  attempt: number = 1
): Promise<string> {
  const filename = `${genId}_${view}${attempt > 1 ? `_v${attempt}` : ''}.png`;
  const key = `${userId}/${filename}`;

  const buffer = Buffer.from(imageData, 'base64');

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  });

  await r2Client.send(command);

  // Use custom domain for public access
  const publicBaseUrl = process.env.R2_CUSTOM_DOMAIN_URL || process.env.R2_PUBLIC_BASE_URL!;
  const url = `${publicBaseUrl}/${key}`;

  console.log(`[variant] Uploaded to R2: ${url}`);
  return url;
}

/**
 * Extract GarmentSpec from generation_history metadata
 */
function extractGarmentSpec(prompt: string, metadata: any): GarmentSpec {
  // Try to extract from existing metadata first
  if (metadata?.garment_spec) {
    return metadata.garment_spec;
  }

  // Fallback: Parse from prompt (basic extraction)
  // In production, this should be saved during Main generation
  const spec: GarmentSpec = {
    silhouette: metadata?.silhouette || 'tailored',
    materials: ['cotton', 'wool blend'],
    palette: [
      { hex: '#000000', pct: 40 },
      { hex: '#FFFFFF', pct: 30 },
      { hex: '#808080', pct: 30 }
    ],
    motifs: [],
    detailing: ['clean seamlines'],
    construction: ['couture finishing', 'refined drape'],
    modelPhrase: metadata?.demographic ? `model, ${metadata.demographic}` : undefined,
    background: metadata?.background === 'white' ? 'pure white studio cyclorama' : undefined
  };

  // Try to extract materials from prompt
  const materialsMatch = prompt.match(/MATERIALS?:\s*([^\n]+)/i);
  if (materialsMatch) {
    spec.materials = materialsMatch[1].split(',').map(m => m.trim());
  }

  return spec;
}

export async function POST(req: NextRequest) {
  try {
    const { gen_id, view } = await req.json();

    if (!gen_id || !view) {
      return NextResponse.json(
        { error: 'gen_id and view are required' },
        { status: 400 }
      );
    }

    if (view !== 'side' && view !== 'back') {
      return NextResponse.json(
        { error: 'view must be "side" or "back"' },
        { status: 400 }
      );
    }

    console.log(`[variant] Request for ${view} view of gen_id: ${gen_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get generation data
    const { data: genData, error: genError } = await supabase
      .from('generation_history')
      .select('prompt, user_id, metadata, seed, r2_url')
      .eq('id', gen_id)
      .single();

    if (genError || !genData) {
      console.error('[variant] Generation not found:', genError);
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    const { prompt, user_id, metadata = {}, r2_url: mainImageUrl } = genData;
    const variants = metadata.variants || [];

    // Check if this variant already exists and is completed
    const existing = variants.find((v: any) => v.type === view);
    if (existing && existing.status === 'completed') {
      console.log(`[variant] ${view} variant already exists:`, existing.r2_url);
      return NextResponse.json({
        success: true,
        view,
        r2_url: existing.r2_url,
        cached: true
      });
    }

    // Extract or create GarmentSpec
    const spec = extractGarmentSpec(prompt, metadata);
    console.log('[variant] GarmentSpec:', spec);

    // Generate variant with validation and retry
    console.log(`[variant] Starting generation for ${view} view...`);
    const r2Url = await generateVariantWithValidation(
      spec,
      mainImageUrl,
      view as VariantType,
      user_id,
      gen_id
    );

    console.log(`[variant] ${view} generated successfully:`, r2Url);

    // Update generation_history metadata
    const newVariant = {
      type: view,
      r2_url: r2Url,
      status: 'completed',
      created_at: new Date().toISOString()
    };

    const { data: currentData } = await supabase
      .from('generation_history')
      .select('metadata')
      .eq('id', gen_id)
      .single();

    if (currentData) {
      const currentMetadata = currentData.metadata || {};
      const currentVariants = currentMetadata.variants || [];

      const updatedVariants = currentVariants.filter((v: any) => v.type !== view);
      updatedVariants.push(newVariant);

      // Save GarmentSpec if not already saved
      if (!currentMetadata.garment_spec) {
        currentMetadata.garment_spec = spec;
      }

      await supabase
        .from('generation_history')
        .update({
          metadata: {
            ...currentMetadata,
            variants: updatedVariants
          }
        })
        .eq('id', gen_id);

      console.log(`[variant] Updated generation_history metadata (total: ${updatedVariants.length})`);
    }

    // Update published_items if exists
    const { data: publishedItems } = await supabase
      .from('published_items')
      .select('id, metadata, generation_data')
      .contains('generation_data', { session_id: gen_id });

    if (publishedItems && publishedItems.length > 0) {
      console.log(`[variant] Found ${publishedItems.length} published_items to update`);

      for (const item of publishedItems) {
        const pubVariants = item.metadata?.variants || [];
        const updatedPubVariants = pubVariants.filter((v: any) => v.type !== view);
        updatedPubVariants.push({
          type: view,
          r2_url: r2Url,
          status: 'completed'
        });

        await supabase
          .from('published_items')
          .update({
            metadata: {
              ...item.metadata,
              variants: updatedPubVariants
            }
          })
          .eq('id', item.id);
      }

      console.log(`[variant] Updated ${publishedItems.length} published_items`);
    }

    return NextResponse.json({
      success: true,
      view,
      r2_url: r2Url
    });
  } catch (error) {
    console.error('[variant] Error:', error);
    return NextResponse.json(
      {
        error: 'Variant generation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

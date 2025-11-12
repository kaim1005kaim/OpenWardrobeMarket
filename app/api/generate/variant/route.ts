export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callVertexAIImagen } from 'lib/vertex-ai-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

/**
 * Mutate prompt for specific view angle
 */
function mutateForView(basePrompt: string, view: VariantType): string {
  const viewInstructions = {
    side: 'full-body, side profile view (90-degree angle), same outfit, same lighting, consistent styling. Show the side silhouette clearly.',
    back: 'full-body, back view (180-degree), same outfit, same lighting, consistent styling. Show the back design clearly.'
  };

  return `${basePrompt}

[VIEW ANGLE] ${viewInstructions[view]}
[CONSISTENCY] Keep all design details, colors, materials, and styling consistent with the main front view. Only change the camera angle.`;
}

/**
 * Generate variant using Vertex AI Imagen 3 REST API
 */
async function generateVariant(
  prompt: string,
  seed: number,
  view: VariantType
): Promise<{ imageUrl: string; imageData: string }> {
  const mutatedPrompt = mutateForView(prompt, view);

  console.log(`[generate/variant] Generating ${view} view with Imagen 3 via Vertex AI`);
  console.log(`[generate/variant] Prompt (first 200 chars):`, mutatedPrompt.slice(0, 200));

  try {
    // Call Vertex AI Imagen 3 using shared helper
    // Note: seed parameter removed as it's not supported when watermark is enabled
    const data = await callVertexAIImagen(
      'imagen-3.0-generate-002',
      mutatedPrompt,
      {
        sampleCount: 1,
        aspectRatio: '3:4',
        personGeneration: 'allow_adult',
        safetySetting: 'block_only_high'
      }
    );

    console.log('[generate/variant] Imagen 3 response received');

    if (!data.predictions || data.predictions.length === 0) {
      throw new Error('No predictions returned from Imagen 3');
    }

    const prediction = data.predictions[0];

    // Extract base64 image data
    const imageData = prediction.bytesBase64Encoded;

    if (!imageData) {
      console.error('[generate/variant] Prediction structure:', JSON.stringify(prediction, null, 2));
      throw new Error('No image data in prediction response');
    }

    console.log(`[generate/variant] Image generated successfully, size: ${imageData.length} bytes`);

    return { imageUrl: '', imageData };
  } catch (error) {
    console.error('[generate/variant] Vertex AI error:', error);
    throw error;
  }
}

/**
 * Upload image to R2
 */
async function uploadToR2(
  imageData: string,
  userId: string,
  genId: string,
  view: VariantType
): Promise<string> {
  const filename = `${genId}_${view}.png`;
  const key = `${userId}/${filename}`;

  // Convert base64 to buffer
  const buffer = Buffer.from(imageData, 'base64');

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  });

  await r2Client.send(command);

  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL!;
  const url = `${publicBaseUrl}/${key}`;

  console.log(`[generate/variant] Uploaded to R2: ${url}`);
  return url;
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

    console.log(`[generate/variant] Request for ${view} view of gen_id: ${gen_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get generation data
    const { data: genData, error: genError } = await supabase
      .from('generation_history')
      .select('prompt, user_id, metadata, seed')
      .eq('id', gen_id)
      .single();

    if (genError || !genData) {
      console.error('[generate/variant] Generation not found:', genError);
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    const { prompt, user_id, metadata = {}, seed } = genData;
    const variants = metadata.variants || [];

    // Check if this variant already exists
    const existing = variants.find((v: any) => v.type === view);
    if (existing && existing.status === 'completed') {
      console.log(`[generate/variant] ${view} variant already exists:`, existing.r2_url);
      return NextResponse.json({
        success: true,
        view,
        r2_url: existing.r2_url,
        cached: true
      });
    }

    // Generate variant image
    console.log(`[generate/variant] Starting generation for ${view} view...`);
    const { imageData } = await generateVariant(
      prompt,
      seed || Math.floor(Math.random() * 1000000),
      view as VariantType
    );

    // Upload to R2
    console.log(`[generate/variant] Uploading ${view} to R2...`);
    const r2Url = await uploadToR2(imageData, user_id, gen_id, view as VariantType);

    console.log(`[generate/variant] ${view} uploaded successfully:`, r2Url);

    // Update generation_history metadata
    const updatedVariants = variants.filter((v: any) => v.type !== view);
    updatedVariants.push({
      type: view,
      r2_url: r2Url,
      status: 'completed',
      created_at: new Date().toISOString()
    });

    await supabase
      .from('generation_history')
      .update({
        metadata: {
          ...metadata,
          variants: updatedVariants
        }
      })
      .eq('id', gen_id);

    console.log(`[generate/variant] Updated generation_history metadata`);

    // If image is published, update published_items too
    // Match by generation_data->session_id = gen_id
    const { data: publishedItems } = await supabase
      .from('published_items')
      .select('id, metadata, generation_data')
      .contains('generation_data', { session_id: gen_id });

    if (publishedItems && publishedItems.length > 0) {
      console.log(`[generate/variant] Found ${publishedItems.length} published_items to update`);

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

        console.log(`[generate/variant] Updated published_item ${item.id} with ${view} variant`);
      }

      console.log(`[generate/variant] Updated ${publishedItems.length} published_items`);
    } else {
      console.log(`[generate/variant] No published_items found for gen_id: ${gen_id}`);
    }

    return NextResponse.json({
      success: true,
      view,
      r2_url: r2Url
    });
  } catch (error) {
    console.error('[generate/variant] Error:', error);
    return NextResponse.json(
      {
        error: 'Variant generation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

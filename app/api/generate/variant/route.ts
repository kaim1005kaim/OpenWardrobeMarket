export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PredictionServiceClient } from '@google-cloud/aiplatform';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT!;

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
 * Generate variant using Vertex AI Imagen 3
 */
async function generateVariant(
  prompt: string,
  seed: number,
  view: VariantType
): Promise<{ imageUrl: string; imageData: string }> {
  const mutatedPrompt = mutateForView(prompt, view);

  console.log(`[generate/variant] Generating ${view} view with Imagen 3`);
  console.log(`[generate/variant] Prompt (first 200 chars):`, mutatedPrompt.slice(0, 200));

  // Initialize Vertex AI client
  const client = new PredictionServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com'
  });

  const endpoint = `projects/${googleCloudProject}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001`;

  // Prepare request for Imagen 3
  const instance = {
    structValue: {
      fields: {
        prompt: {
          stringValue: mutatedPrompt
        }
      }
    }
  };

  const parameters = {
    structValue: {
      fields: {
        sampleCount: { numberValue: 1 },
        aspectRatio: { stringValue: '3:4' },
        personGeneration: { stringValue: 'allow_adult' },
        safetySetting: { stringValue: 'block_only_high' }
      }
    }
  };

  const request = {
    endpoint,
    instances: [instance],
    parameters
  };

  try {
    const [response] = await client.predict(request);

    console.log('[generate/variant] Vertex AI response received');

    if (!response.predictions || response.predictions.length === 0) {
      throw new Error('No predictions returned from Imagen 3');
    }

    const prediction = response.predictions[0];

    // Extract image data from prediction
    const imageData = prediction.structValue?.fields?.bytesBase64Encoded?.stringValue;

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
  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://open-wardrobe-market.com';

  const response = await fetch(`${apiUrl}/api/upload-to-r2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageData,
      userId,
      filename: `${genId}_${view}.png`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generate/variant] R2 upload failed:', errorText);
    throw new Error(`R2 upload failed: ${response.status}`);
  }

  const { url } = await response.json();
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
    const { data: publishedItems } = await supabase
      .from('published_items')
      .select('id, metadata')
      .eq('image_id', gen_id);

    if (publishedItems && publishedItems.length > 0) {
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

      console.log(`[generate/variant] Updated ${publishedItems.length} published_items`);
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

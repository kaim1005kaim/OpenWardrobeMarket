export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GEMINI_API_KEY!;

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
 * Generate variant using Google AI Studio (Gemini Image)
 */
async function generateVariant(
  prompt: string,
  seed: number,
  view: VariantType
): Promise<{ imageUrl: string; imageData: string }> {
  const mutatedPrompt = mutateForView(prompt, view);

  console.log(`[generate/variant] Generating ${view} view with prompt:`, mutatedPrompt.slice(0, 200));

  // Call Gemini Image API (Imagen 3)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: mutatedPrompt,
            sampleCount: 1
          }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '3:4',
          personGeneration: 'allow_adult',
          safetySetting: 'block_only_high',
          seed: seed // Use same seed for consistency
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generate/variant] Gemini API error:`, response.status, errorText);
    throw new Error(`Gemini API failed: ${response.status}`);
  }

  const result = await response.json();
  const predictions = result.predictions || [];

  if (predictions.length === 0 || !predictions[0].bytesBase64Encoded) {
    throw new Error('No image generated');
  }

  const imageData = predictions[0].bytesBase64Encoded;
  const raiFilteredReason = predictions[0].raiFilteredReason;

  if (raiFilteredReason) {
    console.warn(`[generate/variant] RAI filtered:`, raiFilteredReason);
    throw new Error(`Content filtered: ${raiFilteredReason}`);
  }

  return { imageUrl: '', imageData }; // imageUrl will be set after R2 upload
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
  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
        { error: 'Missing gen_id or view' },
        { status: 400 }
      );
    }

    if (!['side', 'back'].includes(view)) {
      return NextResponse.json(
        { error: 'Invalid view type. Must be "side" or "back"' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get generation data
    const { data: genData, error: genError } = await supabase
      .from('generation_history')
      .select('*')
      .eq('id', gen_id)
      .single();

    if (genError || !genData) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    const { prompt, seed, user_id, metadata } = genData;
    const variants = metadata?.variants || [];

    // Check if variant already exists
    const existingVariant = variants.find((v: any) => v.type === view);
    if (existingVariant && existingVariant.status === 'completed') {
      return NextResponse.json({
        message: 'Variant already exists',
        r2_url: existingVariant.r2_url
      });
    }

    // Generate variant
    console.log(`[generate/variant] Starting ${view} generation for gen_id: ${gen_id}`);

    const { imageData } = await generateVariant(prompt, seed || Math.floor(Math.random() * 1000000), view as VariantType);

    // Upload to R2
    const r2Url = await uploadToR2(imageData, user_id, gen_id, view as VariantType);

    console.log(`[generate/variant] ${view} uploaded to R2:`, r2Url);

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

    // If image is published, update published_items too
    const { data: publishedItem } = await supabase
      .from('published_items')
      .select('id, metadata')
      .eq('user_id', user_id)
      .eq('metadata->>gen_id', gen_id)
      .single();

    if (publishedItem) {
      const pubVariants = publishedItem.metadata?.variants || [];
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
            ...publishedItem.metadata,
            variants: updatedPubVariants
          }
        })
        .eq('id', publishedItem.id);
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

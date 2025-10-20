export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('[generate-embedding] Missing OPENAI_API_KEY - vector embeddings will not be available');
}

/**
 * Generate CLIP embedding for an image using OpenAI's CLIP model
 *
 * The embedding is a 512-dimensional vector that captures the visual features of the image.
 * Images with similar visual characteristics will have similar embeddings (high cosine similarity).
 */
export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageUrl, imageData } = body;

    if (!imageUrl && !imageData) {
      return NextResponse.json(
        { error: 'Missing imageUrl or imageData parameter' },
        { status: 400 }
      );
    }

    console.log('[generate-embedding] Generating CLIP embedding...');

    // OpenAI's CLIP embedding endpoint
    // Note: As of 2024, OpenAI doesn't have a direct CLIP API
    // We'll use a fallback approach with external services or local models

    // Option 1: Use Replicate API (CLIP ViT-B/32)
    // Option 2: Use Hugging Face Inference API
    // Option 3: Self-hosted CLIP model

    // For now, we'll use Hugging Face Inference API
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

    if (!HF_API_KEY) {
      return NextResponse.json(
        { error: 'HUGGINGFACE_API_KEY not configured. Please set it in .env.local' },
        { status: 500 }
      );
    }

    let imageToEmbed: string;

    if (imageUrl) {
      // Fetch image from URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image from URL');
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      imageToEmbed = Buffer.from(imageBuffer).toString('base64');
    } else {
      // Use provided base64 image data
      imageToEmbed = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    }

    // Hugging Face Inference API - CLIP ViT-B/32 model
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: imageToEmbed,
          options: {
            wait_for_model: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-embedding] Hugging Face API error:', errorText);
      throw new Error(`Hugging Face API error: ${errorText}`);
    }

    const embedding = await response.json();

    // Hugging Face returns a flat array of floats
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding format from Hugging Face');
    }

    console.log('[generate-embedding] Generated embedding with dimension:', embedding.length);

    // Normalize to 512 dimensions if needed
    let normalizedEmbedding = embedding;
    if (embedding.length !== 512) {
      // CLIP ViT-B/32 outputs 512 dimensions by default
      // If we get a different size, we need to handle it
      console.warn('[generate-embedding] Unexpected embedding dimension:', embedding.length);

      if (embedding.length > 512) {
        // Truncate
        normalizedEmbedding = embedding.slice(0, 512);
      } else {
        // Pad with zeros
        normalizedEmbedding = [...embedding, ...new Array(512 - embedding.length).fill(0)];
      }
    }

    return NextResponse.json({
      embedding: normalizedEmbedding,
      dimension: normalizedEmbedding.length,
      model: 'openai/clip-vit-base-patch32',
    });
  } catch (error) {
    console.error('[generate-embedding] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate embedding',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

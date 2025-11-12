/**
 * Extract Design Tokens from Main Image
 * Uses Gemini cascade: Flash → Pro (if needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { callVertexAIGemini } from '../../../../../lib/vertex-ai-auth';
import type { DesignTokens } from '../../../../src/types/garment-spec';

export const maxDuration = 60;

const EXTRACTION_PROMPT = `You are a fashion design analyzer. Extract detailed garment specifications from this image.

Return ONLY a valid JSON object with this exact structure:
{
  "garment_type": "coat|jacket|dress|shirt|pants|skirt|etc",
  "silhouette": "boxy|cocoon|oversized|A-line|column|tailored|etc",
  "length": "long|midi|short|cropped",
  "neckline": "mandarin|notch|crew|v-neck|turtleneck|etc",
  "sleeve": "long|short|sleeveless|raglan|dropped|etc",
  "palette_hex": ["#1A1A1A", "#F7CAC9", "#1A233B"],
  "materials": ["technical nylon", "satin", "brushed cotton"],
  "invariant_details": [
    "linear circular appliqués along yoke and sleeve",
    "contrast piping along edges"
  ],
  "seam_map": [
    "vertical panel at side seams",
    "center-back vertical panel"
  ],
  "trim": ["contrast piping", "ribbed cuffs"],
  "gradations": ["hem: deep charcoal → warm amber"],
  "bg_style": "studio|color|color-grad"
}

CRITICAL REQUIREMENTS:
1. palette_hex: Extract 2-5 dominant colors as HEX codes
2. invariant_details: List ALL visible design elements that MUST appear in side/back views
3. seam_map: Document all panel lines and seams (critical for 3D consistency)
4. materials: Identify fabric types from visual texture
5. Be specific and detailed - these tokens will be used to generate matching side/back views

NO explanatory text, ONLY the JSON object.`;

interface ExtractTokensRequest {
  imageUrl: string;
  seed: number;
  demographic: string;
  forceModel?: 'flash' | 'pro' | '2.5';
}

/**
 * Extract tokens with single model
 */
async function extractWithModel(
  imageUrl: string,
  modelId: string,
  timeout: number
): Promise<any> {
  // Fetch image and convert to base64
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image: ${imgRes.status}`);
  }

  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: EXTRACTION_PROMPT
        },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        }
      ]
    }
  ];

  const result = await callVertexAIGemini(
    modelId,
    contents,
    {
      temperature: 0.1,
      maxOutputTokens: 2048
    },
    undefined,
    { timeout }
  );

  const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error('No text response from Gemini');
  }

  // Extract JSON from response
  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Extract with cascade: Flash → Pro → 2.5
 */
async function extractWithCascade(
  imageUrl: string,
  startModel: 'flash' | 'pro' | '2.5' = 'flash'
): Promise<any> {
  const models = [
    { id: 'gemini-1.5-flash-002', name: 'flash', timeout: 20000 },
    { id: 'gemini-1.5-pro-002', name: 'pro', timeout: 30000 },
    { id: 'gemini-2.0-flash-exp', name: '2.5', timeout: 40000 }
  ];

  const startIdx = models.findIndex(m => m.name === startModel);
  if (startIdx === -1) {
    throw new Error(`Invalid start model: ${startModel}`);
  }

  let lastError: Error | null = null;

  for (let i = startIdx; i < models.length; i++) {
    const model = models[i];
    console.log(`[extract-tokens] Trying ${model.name}...`);

    try {
      const tokens = await extractWithModel(imageUrl, model.id, model.timeout);

      // Validate required fields
      const required = ['garment_type', 'silhouette', 'palette_hex', 'materials', 'invariant_details', 'seam_map'];
      const missing = required.filter(key => !tokens[key] || (Array.isArray(tokens[key]) && tokens[key].length === 0));

      if (missing.length === 0) {
        console.log(`[extract-tokens] Success with ${model.name}`);
        return { tokens, model: model.name };
      }

      console.log(`[extract-tokens] ${model.name} missing fields:`, missing);
      lastError = new Error(`Incomplete extraction: missing ${missing.join(', ')}`);

    } catch (error) {
      console.log(`[extract-tokens] ${model.name} failed:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error('All models failed');
}

export async function POST(req: NextRequest) {
  try {
    const body: ExtractTokensRequest = await req.json();
    const { imageUrl, seed, demographic, forceModel } = body;

    if (!imageUrl || !seed || !demographic) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, seed, demographic' },
        { status: 400 }
      );
    }

    console.log('[extract-tokens] Starting extraction:', { imageUrl, seed, forceModel });

    const { tokens, model } = await extractWithCascade(imageUrl, forceModel);

    // Construct final DesignTokens
    const designTokens: DesignTokens = {
      ...tokens,
      seed,
      demographic,
      mainImageUrl: imageUrl
    };

    console.log('[extract-tokens] Extracted tokens:', designTokens);

    return NextResponse.json({
      success: true,
      tokens: designTokens,
      model
    });

  } catch (error) {
    console.error('[extract-tokens] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

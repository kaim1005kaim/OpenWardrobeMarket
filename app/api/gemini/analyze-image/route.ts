export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { callVertexAIGemini } from '../../../lib/vertex-ai-auth';

const FASHION_TAG_PROMPT = `Analyze this fashion design image and generate 5-10 descriptive tags in English, and a brief description in Japanese.

Focus on:
- **Silhouette**: oversized, fitted, relaxed, tailored, structured, loose, etc.
- **Style/Vibe**: minimal, streetwear, luxury, avant-garde, casual, formal, etc.
- **Color palette**: neutral, monochrome, bold, pastel, earth-tones, vibrant, etc.
- **Texture/Material**: smooth, textured, matte, glossy, knit, woven, etc.
- **Design elements**: layered, asymmetric, geometric, organic, deconstructed, etc.

IMPORTANT RULES:
- Tags must be lowercase English words or hyphenated phrases
- Description MUST be in Japanese (日本語)
- NO brand names, logos, celebrities, or watermarks
- NO generic words like "clothing" or "fashion"
- Focus on visual attributes that help find similar designs
- Return 5-10 tags maximum
- You MUST respond with ONLY valid JSON, no markdown formatting

Respond with ONLY this JSON format (no extra text or formatting):
{
  "tags": ["tag1", "tag2", "tag3"],
  "description": "デザインの簡潔な1文の説明（日本語で）"
}`;

export async function POST(req: NextRequest) {
  try {
    console.log('[analyze-image] Request received');

    const body = await req.json();
    const { imageData, mimeType } = body;

    if (!imageData) {
      console.error('[analyze-image] Missing imageData in request body');
      return NextResponse.json(
        { error: 'Missing imageData' },
        { status: 400 }
      );
    }

    console.log('[analyze-image] Analyzing image with Vertex AI Gemini 2.5...', { mimeType });

    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;

    console.log('[analyze-image] Image data length:', imageData.length);
    console.log('[analyze-image] Base64 data length:', base64Data.length);
    console.log('[analyze-image] First 50 chars:', base64Data.substring(0, 50));

    // Validate base64 data
    if (base64Data.length < 100) {
      console.error('[analyze-image] Image data too small, likely invalid');
      return NextResponse.json(
        { error: 'Invalid or corrupted image data' },
        { status: 400 }
      );
    }

    // Call Vertex AI Gemini
    const result = await callVertexAIGemini(
      'gemini-2.5-flash',
      [
        {
          role: 'user',
          parts: [
            { text: FASHION_TAG_PROMPT },
            {
              inline_data: {
                mime_type: mimeType || 'image/png',
                data: base64Data,
              },
            },
          ],
        },
      ],
      {
        temperature: 0.3,
        maxOutputTokens: 512,
      }
    );

    console.log('[analyze-image] Vertex AI Gemini called, waiting for response...');

    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('[analyze-image] No candidates in response');
      return NextResponse.json(
        { error: 'No response from Vertex AI Gemini' },
        { status: 500 }
      );
    }

    const text = candidates[0].content.parts[0].text;

    console.log('[analyze-image] Raw response:', text);
    console.log('[analyze-image] Response length:', text?.length || 0);

    if (!text || text.trim().length === 0) {
      console.error('[analyze-image] Empty response from Vertex AI Gemini');
      return NextResponse.json(
        { error: 'Empty response from Vertex AI Gemini' },
        { status: 500 }
      );
    }

    let parsed;
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[analyze-image] Failed to parse JSON response:', parseError);
      console.error('[analyze-image] Raw text was:', text);
      return NextResponse.json(
        { error: 'Invalid response format from AI', rawResponse: text.substring(0, 200) },
        { status: 500 }
      );
    }

    // Validate and sanitize tags
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t: string) => typeof t === 'string')
          .map((t: string) => t.toLowerCase().trim())
          .filter((t: string) => {
            // Filter out prohibited content
            const prohibited = ['brand', 'logo', 'celebrity', 'watermark', 'text', 'clothing', 'fashion', 'design', 'image'];
            return !prohibited.some((banned) => t.includes(banned));
          })
          .slice(0, 10) // Max 10 tags
      : [];

    const description = typeof parsed.description === 'string'
      ? parsed.description.trim()
      : '';

    const output = {
      tags,
      description,
    };

    console.log('[analyze-image] Generated tags:', output);

    return NextResponse.json(output);
  } catch (error) {
    console.error('[analyze-image] Error:', error);
    console.error('[analyze-image] Error stack:', error instanceof Error ? error.stack : 'N/A');

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('[analyze-image] Missing GOOGLE_API_KEY');
}

const FASHION_TAG_PROMPT = `Analyze this fashion design image and generate 5-10 descriptive tags in English.

Focus on:
- **Silhouette**: oversized, fitted, relaxed, tailored, structured, loose, etc.
- **Style/Vibe**: minimal, streetwear, luxury, avant-garde, casual, formal, etc.
- **Color palette**: neutral, monochrome, bold, pastel, earth-tones, vibrant, etc.
- **Texture/Material**: smooth, textured, matte, glossy, knit, woven, etc.
- **Design elements**: layered, asymmetric, geometric, organic, deconstructed, etc.

IMPORTANT RULES:
- Tags must be lowercase English words or hyphenated phrases
- NO brand names, logos, celebrities, or watermarks
- NO generic words like "clothing" or "fashion"
- Focus on visual attributes that help find similar designs
- Return 5-10 tags maximum

Respond with JSON in this format:
{
  "tags": ["tag1", "tag2", "tag3", ...],
  "description": "Brief 1-sentence description of the design"
}`;

export async function POST(req: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageData, mimeType } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: 'Missing imageData' },
        { status: 400 }
      );
    }

    console.log('[analyze-image] Analyzing image with Gemini Vision...');

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: FASHION_TAG_PROMPT },
            {
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const text = response.text();

    console.log('[analyze-image] Raw response:', text);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error('[analyze-image] Failed to parse JSON response:', parseError);
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
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
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

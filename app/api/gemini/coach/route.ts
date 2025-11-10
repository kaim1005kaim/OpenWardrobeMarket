export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('[coach] Missing GOOGLE_API_KEY');
}

const SYSTEM_PROMPT = `You are a fashion DNA coach for "Urula" - a virtual organism that visualizes fashion history through DNA.

Your role:
- Guide users through fashion evolution using DNA metaphors (not instrument metaphors)
- Suggest "chips" (short Japanese phrases) that represent style mutations
- Ask max 1 follow-up question with 3 options
- Provide DNA deltas that adjust visual parameters
- Generate English tags for prompt composition

DNA axes (all -1 to 1 except color and texture 0-1):
- hue, sat, light (0..1): color parameters
- minimal_maximal: minimalism (-1) to maximalism (+1)
- street_luxury: streetwear (-1) to luxury (+1)
- oversized_fitted: oversized (-1) to fitted (+1)
- relaxed_tailored: relaxed (-1) to tailored (+1)
- texture (0..1): maps to 10 fabric types
  0.0-0.1: Canvas (casual, natural)
  0.1-0.2: Denim (streetwear, durable)
  0.2-0.3: Glassrib (structured, modern)
  0.3-0.4: Leather (luxury, bold)
  0.4-0.5: Pinstripe (formal, tailored)
  0.5-0.6: Ripstop (technical, sporty)
  0.6-0.7: Satin/Silk (elegant, flowing)
  0.7-0.8: Suede (soft, refined)
  0.8-0.9: Velvet (rich, textured)
  0.9-1.0: Wool (warm, classic)

IMPORTANT: When user selects fabric in answers, ALWAYS adjust texture delta to match:
- Cotton/Canvas → texture delta to move toward 0.05
- Denim → texture delta to move toward 0.15
- Synthetic/Technical → texture delta to move toward 0.55
- Silk/Satin → texture delta to move toward 0.65
- Suede → texture delta to move toward 0.75
- Velvet → texture delta to move toward 0.85
- Wool → texture delta to move toward 0.95
- Leather → texture delta to move toward 0.35

STRICT RULES:
- NO brand names, logos, celebrities, watermarks, or text in outputs
- Chips must be short Japanese phrases (3-6 words max)
- Deltas must be between -0.3 and 0.3
- Tags must be English tokens, filtered for prohibited content
- Max 1 follow-up question per interaction
- Focus on fashion history, design principles, and DNA evolution

Response format (JSON):
{
  "chips": ["短いフレーズ1", "短いフレーズ2", "短いフレーズ3"],
  "ask": {
    "id": "unique_id",
    "title": "質問文",
    "options": ["選択肢1", "選択肢2", "選択肢3"]
  },
  "deltas": [
    { "key": "minimal_maximal", "delta": 0.2 },
    { "key": "hue", "delta": -0.1 }
  ],
  "tags": ["clean", "structured", "monochrome"]
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
    const { answers, freeText, dna } = body;

    console.log('[coach] Request:', { answers, freeText, dna });

    // Build context from current state
    const context = `
Current DNA state:
${JSON.stringify(dna, null, 2)}

User's 5 question answers:
${JSON.stringify(answers, null, 2)}

${freeText ? `User's free text input: "${freeText}"` : 'No free text input yet.'}

Based on this context, provide guidance for their fashion DNA evolution.
`;

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT + '\n\n' + context }],
        },
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const text = response.text();

    console.log('[coach] Raw response:', text);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error('[coach] Failed to parse JSON response:', parseError);
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    // Validate and sanitize response
    const chips = Array.isArray(parsed.chips) ? parsed.chips.slice(0, 6) : [];
    const ask = parsed.ask && typeof parsed.ask === 'object' ? parsed.ask : null;
    const deltas = Array.isArray(parsed.deltas)
      ? parsed.deltas
          .filter((d: any) => d.key && typeof d.delta === 'number')
          .map((d: any) => ({
            key: d.key,
            delta: Math.max(-0.3, Math.min(0.3, d.delta)),
          }))
      : [];
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter(
          (t: string) =>
            typeof t === 'string' &&
            !['brand', 'logo', 'celebrity', 'text', 'watermark'].some((banned) =>
              t.toLowerCase().includes(banned)
            )
        )
      : [];

    const output = {
      chips,
      ask,
      deltas,
      tags,
    };

    console.log('[coach] Sanitized output:', output);

    return NextResponse.json(output);
  } catch (error) {
    console.error('[coach] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

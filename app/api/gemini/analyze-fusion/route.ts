export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('[analyze-fusion] Missing GOOGLE_API_KEY');
}

// FUSION専用：画像を服のパラメータに変換する分析プロンプト
const FUSION_ANALYSIS_PROMPT = `You are a fashion design translator.
Convert visual cues into garment specifications (not background scenes).
Output JSON only.

Analyze the image and propose abstract garment features.
Do NOT describe environments.
Map shapes & textures to CLOTHING ONLY.

Return JSON:
{
  "palette": [{"name": "...","hex":"#...","weight":0..1}],
  "silhouette": "oversized | tailored | cocoon | A-line | fitted",
  "materials": ["wool suiting","satin","technical nylon",...],
  "motif_abstractions": [
    {
      "source_cue": "short description of the visual cue",
      "operation": "stripe | pleat | panel | quilting | sash | piping | embroidery | jacquard | gradient dye",
      "placement": ["bodice","sleeve","waist","skirt","lapel","yoke","hem"],
      "style": "tonal | high-contrast | subtle | glossy | matte",
      "scale": "micro | small | medium | large",
      "notes": "how it should transform (no literal objects)"
    }
  ],
  "details": ["obi-inspired belt","chevron seamlines","pinstripe topstitch",...]
}

IMPORTANT RULES:
- Return 2-4 motif_abstractions maximum (avoid overcrowding the garment)
- Palette should have 2-3 colors max with weights summing to 1.0
- NO literal objects (no shrines, no buildings, no text, no logos)
- Focus on abstract operations that translate to garment construction
- You MUST respond with ONLY valid JSON, no markdown formatting`;

// 動的インスピレーション文を生成するプロンプト
const INSPIRATION_PROMPT = `You are a poetic fashion copywriter.

Based on the garment specification below, write a brief, evocative 1-2 sentence inspiration text in English.
This text will guide the AI image generator to create unique fashion designs.

RULES:
- Use metaphorical, atmospheric language (e.g., "where architecture melts into silk", "echoes of urban rhythm in tailored lines")
- DO NOT mention literal objects (no "torii", no "buildings", no "city")
- Focus on abstract concepts: rhythm, balance, tension, fluidity, structure
- Keep it brief: 1-2 sentences maximum
- Use present tense, active voice
- Avoid clichés

Example:
"Curved lines echo architectural grace, transforming into flowing seamlines. Urban grid patterns distill into subtle pinstripes, creating rhythm without literalness."

Garment specification:
{spec}

Return ONLY the inspiration text (no JSON, no quotes, just the raw text).`;

interface MotifAbstraction {
  source_cue: string;
  operation: string;
  placement: string[];
  style: string;
  scale: string;
  notes: string;
}

interface FusionAnalysisResult {
  palette: { name: string; hex: string; weight: number }[];
  silhouette: string;
  materials: string[];
  motif_abstractions: MotifAbstraction[];
  details: string[];
  inspiration?: string;
}

export async function POST(req: NextRequest) {
  try {
    console.log('[analyze-fusion] Request received');

    if (!GOOGLE_API_KEY) {
      console.error('[analyze-fusion] GOOGLE_API_KEY is not configured');
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageData, mimeType, generateInspiration = true } = body;

    if (!imageData) {
      console.error('[analyze-fusion] Missing imageData');
      return NextResponse.json({ error: 'Missing imageData' }, { status: 400 });
    }

    console.log('[analyze-fusion] Analyzing with FUSION prompt...');

    // Remove data URL prefix if present
    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;

    if (base64Data.length < 100) {
      console.error('[analyze-fusion] Image data too small');
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    // Step 1: Analyze image with FUSION prompt
    const analysisResult = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: FUSION_ANALYSIS_PROMPT },
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
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    });

    const analysisText = analysisResult.response.text();
    console.log('[analyze-fusion] Analysis raw response:', analysisText);

    // Parse analysis JSON
    let spec: FusionAnalysisResult;
    try {
      let jsonText = analysisText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      spec = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[analyze-fusion] Failed to parse analysis JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid analysis format', rawResponse: analysisText.substring(0, 200) },
        { status: 500 }
      );
    }

    // Validate and limit motif_abstractions to max 3
    if (spec.motif_abstractions && spec.motif_abstractions.length > 3) {
      spec.motif_abstractions = spec.motif_abstractions.slice(0, 3);
    }

    // Normalize palette to 2-3 colors
    if (spec.palette && spec.palette.length > 3) {
      spec.palette = spec.palette.slice(0, 3);
    }

    // Normalize weights
    if (spec.palette && spec.palette.length > 0) {
      const totalWeight = spec.palette.reduce((sum, c) => sum + (c.weight || 0), 0);
      if (totalWeight > 0) {
        spec.palette = spec.palette.map(c => ({
          ...c,
          weight: c.weight / totalWeight
        }));
      }
    }

    // Step 2: Generate inspiration text (optional)
    if (generateInspiration) {
      console.log('[analyze-fusion] Generating dynamic inspiration text...');

      const inspirationPrompt = INSPIRATION_PROMPT.replace(
        '{spec}',
        JSON.stringify(spec, null, 2)
      );

      const inspirationResult = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: inspirationPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 256,
        },
      });

      const inspirationText = inspirationResult.response.text().trim();
      console.log('[analyze-fusion] Generated inspiration:', inspirationText);

      spec.inspiration = inspirationText;
    }

    console.log('[analyze-fusion] Final spec:', spec);

    return NextResponse.json(spec);
  } catch (error) {
    console.error('[analyze-fusion] Error:', error);
    console.error('[analyze-fusion] Stack:', error instanceof Error ? error.stack : 'N/A');

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

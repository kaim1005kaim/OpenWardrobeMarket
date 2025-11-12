export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { callVertexAIGemini } from 'lib/vertex-ai-auth';

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

    const body = await req.json();
    const { imageData, mimeType, generateInspiration = true } = body;

    if (!imageData) {
      console.error('[analyze-fusion] Missing imageData');
      return NextResponse.json({ error: 'Missing imageData' }, { status: 400 });
    }

    console.log('[analyze-fusion] Analyzing with Vertex AI Gemini 2.5 FUSION prompt...');

    // Remove data URL prefix if present
    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;

    if (base64Data.length < 100) {
      console.error('[analyze-fusion] Image data too small');
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Step 1: Analyze image with FUSION prompt using Vertex AI
    const analysisResult = await callVertexAIGemini(
      'gemini-2.5-flash',
      [
        {
          role: 'user',
          parts: [
            { text: FUSION_ANALYSIS_PROMPT },
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
        temperature: 0.4,
        maxOutputTokens: 8192,
      }
    );

    // Validate response structure
    console.log('[analyze-fusion] Checking response structure...');
    console.log('[analyze-fusion] analysisResult type:', typeof analysisResult);
    console.log('[analyze-fusion] analysisResult.candidates exists:', !!analysisResult?.candidates);
    console.log('[analyze-fusion] analysisResult.candidates length:', analysisResult?.candidates?.length);

    if (!analysisResult?.candidates || analysisResult.candidates.length === 0) {
      console.error('[analyze-fusion] No candidates in response:', JSON.stringify(analysisResult, null, 2));
      return NextResponse.json(
        { error: 'No response from Vertex AI Gemini' },
        { status: 500 }
      );
    }

    console.log('[analyze-fusion] Getting first candidate...');
    const candidate = analysisResult.candidates[0];
    console.log('[analyze-fusion] candidate exists:', !!candidate);
    console.log('[analyze-fusion] candidate.content exists:', !!candidate?.content);
    console.log('[analyze-fusion] candidate.content.parts exists:', !!candidate?.content?.parts);
    console.log('[analyze-fusion] candidate.content.parts length:', candidate?.content?.parts?.length);
    console.log('[analyze-fusion] candidate.finishReason:', candidate?.finishReason);

    // Check for MAX_TOKENS error
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.error('[analyze-fusion] Response truncated due to MAX_TOKENS');
      console.error('[analyze-fusion] usageMetadata:', JSON.stringify(analysisResult.usageMetadata, null, 2));
      return NextResponse.json(
        { error: 'Response truncated due to token limit. Please try with a simpler image or shorter prompt.' },
        { status: 500 }
      );
    }

    if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
      console.error('[analyze-fusion] Invalid candidate structure:', JSON.stringify(candidate, null, 2));
      console.error('[analyze-fusion] Full response:', JSON.stringify(analysisResult, null, 2));
      return NextResponse.json(
        { error: 'Invalid response structure from Vertex AI Gemini' },
        { status: 500 }
      );
    }

    const firstPart = candidate.content.parts[0];
    if (!firstPart || typeof firstPart.text !== 'string') {
      console.error('[analyze-fusion] Invalid part structure:', JSON.stringify(firstPart, null, 2));
      return NextResponse.json(
        { error: 'Invalid text content in Vertex AI Gemini response' },
        { status: 500 }
      );
    }

    const analysisText = firstPart.text;
    console.log('[analyze-fusion] Analysis raw response:', analysisText);

    // Parse analysis JSON
    let spec: FusionAnalysisResult;
    let jsonText = analysisText.trim();

    try {
      // Remove markdown code blocks
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      // Clean up common JSON syntax errors from LLM responses
      // Fix trailing commas before closing brackets/braces
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
      // Fix missing commas between properties (like "0.4\n    {" -> "0.4},\n    {")
      jsonText = jsonText.replace(/(\d+)\s*\n\s*\{/g, '$1},\n    {');

      spec = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[analyze-fusion] Failed to parse analysis JSON:', parseError);
      console.error('[analyze-fusion] Attempted to parse:', jsonText.substring(0, 500));
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

      const inspirationResult = await callVertexAIGemini(
        'gemini-2.5-flash',
        [
          {
            role: 'user',
            parts: [{ text: inspirationPrompt }],
          },
        ],
        {
          temperature: 0.8,
          maxOutputTokens: 256,
        }
      );

      const inspirationText = inspirationResult.candidates[0].content.parts[0].text.trim();
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

export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 60; // 60 seconds max for FUSION analysis (requires Vercel Pro plan, otherwise defaults to 10s)

import { NextRequest, NextResponse } from 'next/server';
import { callVertexAIGemini } from 'lib/vertex-ai-auth';

// FUSION専用：画像を服のパラメータに変換する分析プロンプト (Creative Director Mode v2.0)
const FUSION_ANALYSIS_PROMPT = `You are an elite fashion Creative Director with deep expertise in emotional storytelling through garment design.

Your role: Analyze TWO fashion images (A and B) and interpret their EMOTIONAL ESSENCE - not just physical features.
Output JSON only.

CREATIVE DIRECTOR MODE RULES:
1. EMOTIONAL INTERPRETATION (Primary Focus):
   - What FEELING does each image evoke? (tension, serenity, rebellion, elegance, playfulness, etc.)
   - What is the MOOD or ATMOSPHERE? (urban edge, romantic softness, architectural precision, organic flow)
   - What STORY does each garment tell?
   - Think like a fashion editor: "This is not just a jacket, it's a statement of..."

2. FUSION STRATEGY (Chemical Reaction):
   - How can these TWO emotions/concepts FUSE into something NEW?
   - Find the TENSION or HARMONY between them
   - Example: "Structure meets fluidity" → rigid tailoring with flowing panels
   - Example: "Urban grit fused with ethereal lightness" → technical fabrics in soft silhouettes

3. ABSTRACTION (Technical Translation):
   - Convert visual cues into FASHION CONSTRUCTION VOCABULARY:
     * Shapes → seamlines, panels, pleats, draping techniques
     * Patterns → stripe operations, jacquard, gradient dye, quilting
     * Textures → fabric surface treatments, embroidery, piping
     * Colors → palette extraction with proper distribution
     * Structures → silhouette, construction details, finishing
   - NEVER include literal objects, logos, text, brand names, or recognizable imagery

4. Examples of proper emotional abstraction:
   ❌ BAD: "torii gate" → ✅ GOOD: "vertical pillar effect via contrast panel placement | evokes spiritual balance through symmetry"
   ❌ BAD: "Nike swoosh" → ✅ GOOD: "asymmetric diagonal line as contrast piping | conveys dynamic energy and forward motion"
   ❌ BAD: "cherry blossoms" → ✅ GOOD: "delicate scattered appliqué in tonal palette | captures ephemeral beauty and seasonal transition"

Return JSON:
{
  "palette": [{"name": "...","hex":"#...","weight":0..1}],
  "silhouette": "oversized | tailored | cocoon | A-line | fitted | boxy | column | mermaid | parachute",
  "materials": ["wool suiting","satin","technical nylon","brushed cotton","organza",...],
  "motif_abstractions": [
    {
      "source_cue": "describe the visual element you're abstracting",
      "operation": "stripe | pleat | panel | quilting | sash | piping | embroidery | jacquard | gradient dye | asymmetric cut | contrast insert",
      "placement": ["bodice","sleeve","waist","skirt","lapel","yoke","hem","collar","cuff"],
      "style": "tonal | high-contrast | subtle | glossy | matte | textured",
      "scale": "micro | small | medium | large",
      "notes": "how this translates to garment construction (MUST be abstract, no literal objects)",
      "emotional_intent": "what feeling/story this design element conveys"
    }
  ],
  "details": ["architectural seamlines","contrast piping along edges","chevron topstitch pattern",...],

  "fusion_concept": "1-3 sentence design philosophy explaining the FUSION strategy. Focus on emotional narrative, not technical specs. Example: 'Where structured minimalism dissolves into organic movement. This piece captures the tension between control and release, expressing modern duality through fabric and form.'",

  "emotional_keywords": ["structured", "fluid", "urban", "ethereal", "tension", "harmony", ...],

  "dominant_trait_analysis": "Brief explanation of which image (A or B) provides the PRIMARY silhouette/structure vs. which provides ACCENT details. Example: 'Image A provides the architectural foundation (tailored structure), while Image B injects organic softness (flowing drape, curved seamlines).'"
}

STRICT OUTPUT REQUIREMENTS:
- fusion_concept: 1-3 sentences, focus on WHY not WHAT
- emotional_keywords: 3-6 keywords that capture the mood/feeling
- dominant_trait_analysis: Clear strategy for how A and B combine
- motif_abstractions: 2-3 maximum (clean, focused design)
- Palette: 2-3 colors with weights summing to 1.0
- ALL motifs must be abstract fashion operations (no objects, no scenes, no logos)
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
  emotional_intent?: string; // v2.0: Emotional meaning of this design element
}

interface FusionAnalysisResult {
  palette: { name: string; hex: string; weight: number }[];
  silhouette: string;
  materials: string[];
  motif_abstractions: MotifAbstraction[];
  details: string[];
  inspiration?: string;

  // v2.0 Emotional Interpretation Fields
  fusion_concept?: string; // 1-3 sentence design philosophy
  emotional_keywords?: string[]; // 3-6 mood/feeling keywords
  dominant_trait_analysis?: string; // Strategy for combining images A & B
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[analyze-fusion] Request received at', new Date().toISOString());

    const parseStart = Date.now();
    const body = await req.json();
    console.log(`[analyze-fusion] ⏱️ Body parsing: ${Date.now() - parseStart}ms`);

    const { imageData, mimeType, generateInspiration = true } = body;

    console.log('[analyze-fusion] Request body keys:', Object.keys(body));
    console.log('[analyze-fusion] imageData type:', typeof imageData);
    console.log('[analyze-fusion] imageData length:', imageData?.length || 0);
    console.log('[analyze-fusion] mimeType:', mimeType);

    if (!imageData) {
      console.error('[analyze-fusion] Missing imageData');
      return NextResponse.json({ error: 'Missing imageData' }, { status: 400 });
    }

    console.log('[analyze-fusion] Analyzing with Vertex AI Gemini 2.5 FUSION prompt...');

    // Remove data URL prefix if present
    const cleanStart = Date.now();
    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;
    console.log(`[analyze-fusion] ⏱️ Base64 cleaning: ${Date.now() - cleanStart}ms`);

    console.log('[analyze-fusion] base64Data length after cleaning:', base64Data.length);

    if (base64Data.length < 100) {
      console.error('[analyze-fusion] Image data too small');
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Step 1: Analyze image with FUSION prompt using Vertex AI
    const geminiStart = Date.now();
    console.log('[analyze-fusion] 🚀 Starting Vertex AI Gemini call...');

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
      },
      undefined, // systemInstruction
      { timeout: 45000 } // 45s timeout for Gemini vision analysis
    );

    console.log(`[analyze-fusion] ⏱️ Vertex AI Gemini analysis: ${Date.now() - geminiStart}ms`);

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

      // Check if image was actually processed
      const promptDetails = analysisResult.usageMetadata?.promptTokensDetails || [];
      const hasImage = promptDetails.some((d: any) => d.modality === 'IMAGE');

      if (!hasImage) {
        console.error('[analyze-fusion] CRITICAL: Image data was not included in the request to Vertex AI!');
        console.error('[analyze-fusion] This might be due to request size limits or network issues.');
        return NextResponse.json(
          { error: 'Image upload failed. Please try with a smaller image (under 200KB).' },
          { status: 413 }
        );
      }

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
    console.log('[analyze-fusion] Analysis raw response (first 500 chars):', analysisText.substring(0, 500));

    // Parse analysis JSON
    const jsonParseStart = Date.now();
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
      console.log(`[analyze-fusion] ⏱️ JSON parsing & validation: ${Date.now() - jsonParseStart}ms`);
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
      const inspirationStart = Date.now();

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
        },
        undefined, // systemInstruction
        { timeout: 20000 } // 20s timeout for inspiration generation (text-only)
      );

      const inspirationText = inspirationResult.candidates[0].content.parts[0].text.trim();
      console.log('[analyze-fusion] Generated inspiration:', inspirationText);
      console.log(`[analyze-fusion] ⏱️ Inspiration generation: ${Date.now() - inspirationStart}ms`);

      spec.inspiration = inspirationText;
    }

    console.log('[analyze-fusion] Final spec:', spec);
    console.log(`[analyze-fusion] ⏱️ TOTAL REQUEST TIME: ${Date.now() - startTime}ms`);

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

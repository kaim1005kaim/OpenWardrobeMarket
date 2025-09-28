// DeepSeek APIを使ったプロンプト生成
import { ChatSelections, LlmPromptResult } from './types';
import { NEGATIVE_BASE } from './mappings';

const SYSTEM_PROMPT = `You are a fashion prompt composer for a Midjourney-like API.
Goal: Convert user's intents into a concise, production-ready prompt for generating a PRINT-READY fashion image.

HARD CONSTRAINTS:
- English output only.
- Single human model, full-body composition, one person only.
- Clean minimal studio-like background. No text, words, letters, logos, brands, celebrities.
- Respect safety: avoid copyrighted logos, trademarked patterns, recognizable faces.
- Always suitable for apparel print usage.

OUTPUT FORMAT: Strict JSON (no comments), schema:
{
  "prompt": "string",
  "negatives": ["string", ...],
  "quality": "standard|high|ultra",
  "cameraAngle": "full-body|portrait|random",
  "aspectRatio": "3:4|1:1|2:3|9:16|16:9",
  "creativity": "conservative|balanced|experimental|maximum",
  "styleTags": ["string", ...],
  "colorTags": ["string", ...],
  "notes": "string"
}

COMPOSITION GUIDELINES:
- Start with clothing category neutral: "fashion lookbook style, professional fashion photography".
- Inject selected vibe/silhouette/palette/mood/signature in a natural order. Prefer concise adjectives over long clauses.
- If a reference image analysis is provided (style/shape/palette keywords), merge them subtly without copying logos/unique emblems.
- Keep 1–2 sentences max before comma-separated attribute list; avoid verbosity.

PRINT-READY TONE:
- lighting: "studio lighting, good lighting"
- detail: choose level by quality
- background: "clean seamless backdrop" or "soft gradient background"

NEGATIVES (base):
["text","words","letters","typography","logos","brands","celebrities","multiple people","collage","grid","panels","split screen","comic style","manga","multiple angles","contact sheet"]

PARAMETER HINTS:
- creativity → style strength (balanced=default stylize, experimental↑)
- aspect ratio default 3:4 for full-body fashion
- quality: high for marketplace, ultra only if explicitly asked

Return JSON only.`;

export async function composeWithDeepSeek(input: ChatSelections): Promise<LlmPromptResult> {
  const userMessage = JSON.stringify({
    'User selections': {
      vibe: input.vibe || undefined,
      silhouette: input.silhouette || undefined,
      palette: input.palette || undefined,
      mood: input.mood || undefined,
      signature: input.signature || [],
      freeText: input.freeText || undefined,
      customRequest: input.customRequest || undefined,
      refAnalysis: input.refAnalysis || undefined
    },
    'Preferred': {
      aspectRatio: input.aspectRatio || '3:4',
      quality: input.quality || 'high',
      creativity: input.creativity || 'balanced'
    }
  });

  try {
    const response = await fetch('/api/deepseek-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        user: userMessage
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const parsed = data.result || {};

    // バリデーション & フォールバック
    const result: LlmPromptResult = {
      prompt: String(parsed.prompt || 'fashion lookbook style, professional fashion photography'),
      negatives: Array.isArray(parsed.negatives) ? parsed.negatives : [...NEGATIVE_BASE],
      quality: parsed.quality || input.quality || 'high',
      cameraAngle: parsed.cameraAngle || 'full-body',
      aspectRatio: parsed.aspectRatio || input.aspectRatio || '3:4',
      creativity: parsed.creativity || input.creativity || 'balanced',
      styleTags: Array.isArray(parsed.styleTags) ? parsed.styleTags : [],
      colorTags: Array.isArray(parsed.colorTags) ? parsed.colorTags : [],
      notes: parsed.notes || ''
    };

    // セーフティ: 最低限の否定語は必ず付加
    const essentialNegatives = ['text', 'logos', 'multiple people', 'brands', 'celebrities'];
    for (const neg of essentialNegatives) {
      if (!result.negatives.includes(neg)) {
        result.negatives.push(neg);
      }
    }

    return result;
  } catch (error) {
    console.error('[DeepSeek] Error:', error);
    
    // フォールバック: 基本的なプロンプト生成
    return fallbackPromptGeneration(input);
  }
}

// DeepSeek APIが失敗した場合のフォールバック
function fallbackPromptGeneration(input: ChatSelections): LlmPromptResult {
  const parts: string[] = [
    'single model',
    'full-body fashion photography',
    'professional studio lighting',
    'clean minimal background'
  ];

  if (input.vibe) parts.push(input.vibe);
  if (input.silhouette) parts.push(input.silhouette);
  if (input.palette) parts.push(`${input.palette} color palette`);
  if (input.mood) parts.push(`${input.mood} mood`);
  if (input.signature?.length) parts.push(...input.signature);
  if (input.freeText) parts.push(input.freeText);
  if (input.customRequest) parts.push(input.customRequest);

  return {
    prompt: parts.join(', '),
    negatives: [...NEGATIVE_BASE],
    quality: input.quality || 'high',
    cameraAngle: 'full-body',
    aspectRatio: input.aspectRatio || '3:4',
    creativity: input.creativity || 'balanced',
    styleTags: [input.vibe, input.silhouette].filter(Boolean) as string[],
    colorTags: input.palette ? [input.palette] : [],
    notes: 'Fallback generation (DeepSeek unavailable)'
  };
}
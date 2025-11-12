/**
 * Same-Design Similarity Checking
 * Validates that SIDE/BACK variants maintain identical garment design
 */

import { callVertexAIGemini } from './vertex-ai-auth';
import type { DesignTokens } from '../src/types/garment-spec';

/**
 * Color similarity using simple hex comparison
 * Returns 0-1 score
 */
function colorSimilarity(hex1: string[], hex2: string[]): number {
  if (hex1.length === 0 || hex2.length === 0) return 0;

  // Count matching colors (order-independent)
  let matches = 0;
  const set2 = new Set(hex2.map(h => h.toLowerCase()));

  for (const color of hex1) {
    if (set2.has(color.toLowerCase())) {
      matches++;
    }
  }

  // Jaccard similarity
  const union = new Set([...hex1.map(h => h.toLowerCase()), ...hex2.map(h => h.toLowerCase())]);
  return matches / union.size;
}

/**
 * Detail similarity using Jaccard index
 */
function detailSimilarity(details1: string[], details2: string[]): number {
  if (details1.length === 0 && details2.length === 0) return 1;
  if (details1.length === 0 || details2.length === 0) return 0;

  const set1 = new Set(details1.map(d => d.toLowerCase().trim()));
  const set2 = new Set(details2.map(d => d.toLowerCase().trim()));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Extract design tokens from variant image
 */
async function extractVariantTokens(imageUrl: string): Promise<Partial<DesignTokens>> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch variant image: ${imgRes.status}`);
  }

  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

  const prompt = `Extract garment specifications from this image.
Return ONLY a JSON object:
{
  "palette_hex": ["#XXXXXX", ...],
  "invariant_details": ["detail1", "detail2", ...],
  "seam_map": ["seam1", "seam2", ...]
}

NO explanatory text.`;

  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
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
    'gemini-1.5-flash-002',
    contents,
    { temperature: 0.1, maxOutputTokens: 1024 },
    undefined,
    { timeout: 20000 }
  );

  const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error('No text response from Gemini');
  }

  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in response');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Calculate overall similarity score
 * α * colorSim + β * detailSim
 */
export async function calculateSimilarity(
  mainTokens: DesignTokens,
  variantUrl: string,
  weights = { color: 0.4, detail: 0.6 }
): Promise<{ score: number; breakdown: { color: number; detail: number } }> {
  console.log('[similarity] Extracting variant tokens...');
  const variantTokens = await extractVariantTokens(variantUrl);

  console.log('[similarity] Main palette:', mainTokens.palette_hex);
  console.log('[similarity] Variant palette:', variantTokens.palette_hex);

  const colorSim = colorSimilarity(
    mainTokens.palette_hex,
    variantTokens.palette_hex || []
  );

  const detailSim = detailSimilarity(
    [...mainTokens.invariant_details, ...mainTokens.seam_map],
    [...(variantTokens.invariant_details || []), ...(variantTokens.seam_map || [])]
  );

  const score = weights.color * colorSim + weights.detail * detailSim;

  console.log('[similarity] Scores:', { color: colorSim, detail: detailSim, overall: score });

  return {
    score,
    breakdown: {
      color: colorSim,
      detail: detailSim
    }
  };
}

/**
 * Validate that variant matches main design
 * Returns true if similarity >= threshold
 */
export async function isSameDesign(
  mainTokens: DesignTokens,
  variantUrl: string,
  threshold = 0.7
): Promise<{ ok: boolean; score: number; breakdown: { color: number; detail: number } }> {
  try {
    const { score, breakdown } = await calculateSimilarity(mainTokens, variantUrl);
    return {
      ok: score >= threshold,
      score,
      breakdown
    };
  } catch (error) {
    console.error('[similarity] Error:', error);
    return {
      ok: false,
      score: 0,
      breakdown: { color: 0, detail: 0 }
    };
  }
}

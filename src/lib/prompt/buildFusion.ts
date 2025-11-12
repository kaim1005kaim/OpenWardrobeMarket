/**
 * FUSION Mode Prompt Composition
 *
 * Builds Imagen 3 prompts from analyzed garment specifications
 * with diversity controls for silhouette, demographics, and background.
 */

import {
  SILHOUETTES,
  type Silhouette,
  applyCooldown,
  sampleTopKSoftmax,
  sampleDemographic,
  demographicToPrompt,
  sampleBackground,
  backgroundToPrompt,
  formatSilhouetteForPrompt,
  DEFAULT_DEMOGRAPHIC_DISTRIBUTION,
  DEFAULT_BACKGROUND_DISTRIBUTION
} from '../diversity-control';

export interface FusionSpec {
  palette: { name: string; hex: string; weight: number }[];
  silhouette?: string;
  materials: string[];
  motif_abstractions: {
    source_cue: string;
    operation: string;
    placement: string[];
    style: string;
    scale: string;
    notes: string;
  }[];
  details: string[];
  inspiration?: string;
}

export interface FusionPromptOptions {
  userId?: string;
  timestamp?: number;
  recentSilhouettes?: string[];
  enableDiversitySampling?: boolean;
  aspectRatio?: '3:4' | '4:3' | '1:1';
}

export interface FusionPromptResult {
  prompt: string;
  negativePrompt: string;
  selectedSilhouette: string;
  selectedDemographic: string;
  selectedBackground: string;
  aspectRatio: string;
}

const NEGATIVE_PROMPT =
  "no text, no words, no logos, no brand names, no watermarks, no signatures, " +
  "no celebrity faces, no specific identifiable people, no multiple people, " +
  "no deformed limbs, no extra limbs, no distorted anatomy, " +
  "no literal objects from source images (no buildings, no shrines, no products), " +
  "no photographic backgrounds, focus on garment only";

/**
 * Compose FUSION mode prompt with diversity controls
 */
export function composeFusionPrompt(
  spec: FusionSpec,
  options: FusionPromptOptions = {}
): FusionPromptResult {
  const {
    userId = 'anonymous',
    timestamp = Date.now(),
    recentSilhouettes = [],
    enableDiversitySampling = true,
    aspectRatio = '3:4'
  } = options;

  // 1. Select silhouette with diversity control
  let selectedSilhouette: Silhouette;

  if (enableDiversitySampling) {
    // Apply cooldown to prevent repetition
    const weights = applyCooldown(
      SILHOUETTES,
      recentSilhouettes as Silhouette[],
      { window: 5, factor: 0.35 }
    );

    // If spec has silhouette suggestion, boost its weight
    if (spec.silhouette) {
      const suggested = spec.silhouette.toLowerCase() as Silhouette;
      if (SILHOUETTES.includes(suggested)) {
        const currentWeight = weights.get(suggested) || 1.0;
        weights.set(suggested, currentWeight * 1.5);
      }
    }

    selectedSilhouette = sampleTopKSoftmax(weights, { k: 4, temperature: 0.85 });
  } else {
    // Use spec silhouette or fallback
    const suggested = spec.silhouette?.toLowerCase() as Silhouette;
    selectedSilhouette = SILHOUETTES.includes(suggested) ? suggested : 'tailored';
  }

  // 2. Select demographic
  const seed = `${userId}-${timestamp}`;
  const demographic = enableDiversitySampling
    ? sampleDemographic(DEFAULT_DEMOGRAPHIC_DISTRIBUTION, seed)
    : 'asian';
  const modelPhrase = demographicToPrompt(demographic);

  // 3. Select background
  const backgroundType = enableDiversitySampling
    ? sampleBackground(DEFAULT_BACKGROUND_DISTRIBUTION)
    : 'white';
  const backgroundPhrase = backgroundToPrompt(
    backgroundType,
    spec.palette.map(c => c.hex)
  );

  // 4. Build palette description
  const paletteDesc = spec.palette
    .map(c => `${c.name} (${c.hex}, ${Math.round(c.weight * 100)}%)`)
    .join(', ');

  // 5. Build materials list (top 3)
  const materialsDesc = spec.materials.slice(0, 3).join(', ');

  // 6. Build motif abstractions description
  const motifsDesc = spec.motif_abstractions
    .map(m => {
      const placementStr = m.placement.slice(0, 2).join(' and ');
      return `${m.operation} at ${placementStr} (${m.style}, ${m.scale} scale): ${m.notes}`;
    })
    .join('\n- ');

  // 7. Build details list
  const detailsDesc = spec.details.slice(0, 4).join(', ');

  // 8. Compose final prompt
  const prompt = `FASHION EDITORIAL, full-body fashion photography, ${aspectRatio} composition, centered model.

GARMENT FOCUS: High-end fashion design, studio presentation, product-forward photography.

BACKGROUND: ${backgroundPhrase}

SILHOUETTE: ${formatSilhouetteForPrompt(selectedSilhouette)}

MATERIALS: ${materialsDesc}, luxurious fabric quality

COLOR PALETTE: ${paletteDesc}
Use these colors in garment construction with soft, editorial tonality.

ABSTRACT DESIGN ELEMENTS (NO LITERAL OBJECTS):
- ${motifsDesc}

CONSTRUCTION DETAILS: ${detailsDesc}
Clean seamlines, couture finishing, refined drape and structure.

LIGHTING: Soft editorial lighting, high CRI (Color Rendering Index), subtle specular highlights to reveal fabric texture and construction quality.

CAMERA: 50-85mm equivalent focal length, eye-level perspective, fashion editorial style, sharp focus on garment with subtle background separation.

MODEL: ${modelPhrase}, minimal styling, neutral expression, professional pose showcasing garment construction.

QUALITY: High resolution, editorial fashion photography standard, impeccable tailoring and finishing visible.

${spec.inspiration ? `\nCREATIVE DIRECTION: ${spec.inspiration}` : ''}

CRITICAL: All design elements must be abstract fashion operations (seamlines, panels, pleats, embroidery, etc.). NO literal objects, logos, text, or recognizable imagery from source materials.`;

  return {
    prompt,
    negativePrompt: NEGATIVE_PROMPT,
    selectedSilhouette,
    selectedDemographic: demographic,
    selectedBackground: backgroundType,
    aspectRatio
  };
}

/**
 * Validate FUSION spec has required fields
 */
export function validateFusionSpec(spec: any): spec is FusionSpec {
  if (!spec || typeof spec !== 'object') return false;
  if (!Array.isArray(spec.palette) || spec.palette.length === 0) return false;
  if (!Array.isArray(spec.materials) || spec.materials.length === 0) return false;
  if (!Array.isArray(spec.motif_abstractions)) return false;
  if (!Array.isArray(spec.details)) return false;

  return true;
}

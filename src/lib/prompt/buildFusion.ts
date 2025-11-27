/**
 * FUSION Mode Prompt Composition
 *
 * Builds Imagen 3 prompts from analyzed garment specifications
 * with diversity controls for silhouette, demographics, and background.
 */

import {
  SILHOUETTES,
  type Silhouette,
  type DemographicKey,
  applyCooldown,
  sampleTopKSoftmax,
  sampleDemographic,
  demographicToPrompt,
  sampleBackground,
  backgroundToPrompt,
  formatSilhouetteForPrompt,
  sampleDetailedDemographic,
  sampleModelPhrase,
  DEFAULT_DEMOGRAPHIC_DISTRIBUTION,
  DEFAULT_BACKGROUND_DISTRIBUTION
} from '../diversity-control';
import {
  silhouetteDescription,
  getBaseSilhouetteWeights
} from '../diversity-config';

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
    emotional_intent?: string; // v2.0
  }[];
  details: string[];
  inspiration?: string;

  // v2.0 Emotional Interpretation Fields
  fusion_concept?: string; // 1-3 sentence design philosophy
  emotional_keywords?: string[]; // 3-6 mood/feeling keywords
  dominant_trait_analysis?: string; // Strategy for combining images A & B
}

export interface FusionPromptOptions {
  userId?: string;
  timestamp?: number;
  recentSilhouettes?: string[];
  enableDiversitySampling?: boolean;
  aspectRatio?: '3:4' | '4:3' | '1:1';
  gender?: 'mens' | 'womens';
  optionalPrompt?: string;
}

export interface FusionPromptResult {
  prompt: string;
  negativePrompt: string;
  selectedSilhouette: string;
  selectedDemographic: string | DemographicKey;
  selectedBackground: string;
  aspectRatio: string;
  metadata?: {
    silhouetteDescription?: string;
    modelPhrase?: string;
  };
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
    aspectRatio = '3:4',
    gender = 'womens',
    optionalPrompt
  } = options;

  // 1. Select silhouette with diversity control
  let selectedSilhouette: Silhouette;
  let silhouetteDesc: string;
  const seed = `${userId}-${timestamp}`;

  if (enableDiversitySampling) {
    // Start with base weights
    const weights = getBaseSilhouetteWeights();

    // Apply cooldown to prevent repetition
    const cooledWeights = applyCooldown(
      SILHOUETTES,
      recentSilhouettes as Silhouette[]
    );
    cooledWeights.forEach((weight, silhouette) => {
      weights.set(silhouette, weight);
    });

    // If spec has silhouette suggestion, boost its weight (alignment)
    if (spec.silhouette) {
      const suggested = spec.silhouette.toLowerCase() as Silhouette;
      if (SILHOUETTES.includes(suggested)) {
        const currentWeight = weights.get(suggested) || 1.0;
        weights.set(suggested, currentWeight + 0.2); // Add boost
      }
    }

    // Sample with seed for reproducibility
    selectedSilhouette = sampleTopKSoftmax(weights, { seed });
  } else {
    // Use spec silhouette or fallback
    const suggested = spec.silhouette?.toLowerCase() as Silhouette;
    selectedSilhouette = SILHOUETTES.includes(suggested) ? suggested : 'tailored';
  }

  silhouetteDesc = silhouetteDescription(selectedSilhouette);

  // 2. Select demographic (detailed JP/KR-focused) with gender filter
  let demographic: DemographicKey | string;
  let modelPhrase: string;

  if (enableDiversitySampling) {
    // Use new detailed demographic sampling with gender filter
    modelPhrase = sampleModelPhrase(seed, gender);
    demographic = sampleDetailedDemographic(seed, gender);
  } else {
    // Legacy fallback
    demographic = 'asian';
    modelPhrase = demographicToPrompt('asian');
  }

  // 3. Select background
  const backgroundType = enableDiversitySampling
    ? sampleBackground(DEFAULT_BACKGROUND_DISTRIBUTION, seed)
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

  // 8. Build emotional keywords phrase (v2.0)
  const emotionalPhrase = spec.emotional_keywords && spec.emotional_keywords.length > 0
    ? spec.emotional_keywords.join(', ')
    : '';

  // 9. Compose Nano Banana Pro structured prompt (v2.0)
  // Following structured JSON format for better AI comprehension
  const prompt = `FASHION EDITORIAL GENERATION - Nano Banana Pro Format v2.0

=== SUBJECT (Core Design Concept) ===
Design Philosophy: ${spec.fusion_concept || 'Modern fashion fusion concept'}
Emotional Essence: ${emotionalPhrase || 'contemporary, refined, editorial'}
${spec.dominant_trait_analysis ? `Fusion Strategy: ${spec.dominant_trait_analysis}` : ''}

Garment Type: Full-body fashion design
Silhouette: ${selectedSilhouette} silhouette - ${silhouetteDesc}

=== COMPOSITION (Framing & Layout) ===
Format: ${aspectRatio} vertical composition
Framing: Full-body centered model, fashion editorial presentation
Perspective: Eye-level, 50-85mm equivalent focal length
Focus: Product-forward photography, garment as hero

=== STYLE (Visual Language) ===
Mood Keywords: ${emotionalPhrase}
Photography Style: High-end fashion editorial, studio presentation
Quality: Impeccable tailoring and finishing visible, editorial standard

Color Palette: ${paletteDesc}
Materials: ${materialsDesc}, luxurious fabric quality

Abstract Design Elements (NO literal objects):
- ${motifsDesc}

Construction Details: ${detailsDesc}
Clean seamlines, couture finishing, refined drape and structure

=== TECHNICAL CONTROLS ===
Lighting: Soft editorial lighting, high CRI (Color Rendering Index), subtle specular highlights to reveal fabric texture and construction quality
Background: ${backgroundPhrase}
Model: ${modelPhrase}, minimal styling, neutral expression, professional pose showcasing garment construction
Image Quality: High resolution, sharp focus on garment with subtle background separation

${spec.inspiration ? `\n=== CREATIVE DIRECTION ===\n${spec.inspiration}` : ''}
${optionalPrompt ? `\n=== ADDITIONAL NOTES ===\n${optionalPrompt}` : ''}

=== CRITICAL CONSTRAINTS ===
- All design elements must be ABSTRACT fashion operations (seamlines, panels, pleats, embroidery, quilting, piping, etc.)
- NO literal objects, logos, text, or recognizable imagery from source materials
- NO cultural symbols, NO traditional patterns, NO recognizable motifs
- Only abstract geometric and construction-based design language
- Single model, one person only, no multiple people
- Clean minimal background, focus on garment`;

  return {
    prompt,
    negativePrompt: NEGATIVE_PROMPT,
    selectedSilhouette,
    selectedDemographic: demographic,
    selectedBackground: backgroundType,
    aspectRatio,
    metadata: {
      silhouetteDescription: silhouetteDesc,
      modelPhrase
    }
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

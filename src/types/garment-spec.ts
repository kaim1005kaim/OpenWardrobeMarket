/**
 * Garment Specification for View Consistency
 *
 * Fixed specification extracted from Main image generation,
 * used to ensure SIDE/BACK views maintain identical garment details.
 */

export interface GarmentSpec {
  /** Silhouette type (e.g., "cocoon", "tailored", "A-line") */
  silhouette: string;

  /** Materials list (e.g., ["brushed cotton", "cotton jersey"]) */
  materials: string[];

  /** Color palette with hex codes and percentages */
  palette: Array<{
    hex: string;
    name?: string;
    pct: number;
  }>;

  /** Abstract motif operations (NO literal objects) */
  motifs: Array<{
    /** Target location (e.g., "shoulder", "hem", "sleeve") */
    to: string;
    /** Scale: subtle, medium, large */
    scale: 'subtle' | 'medium' | 'large';
    /** Contrast: tonal (low contrast) or contrast (high contrast) */
    contrast: 'tonal' | 'contrast';
    /** Operation description (e.g., "asymmetrical diagonal panel") */
    operation?: string;
  }>;

  /** Construction details (e.g., ["scalloped hem", "contrast piping"]) */
  detailing: string[];

  /** Construction methods (e.g., ["clean seamlines", "couture finishing"]) */
  construction: string[];

  /** Model description (e.g., "female model of Japanese descent in her 20s") */
  modelPhrase?: string;

  /** Background description */
  background?: string;
}

/**
 * View type for variant generation
 */
export type ViewType = 'main' | 'side' | 'back';

/**
 * View validation result from Gemini
 */
export interface ViewValidation {
  /** Whether the view matches the expected type */
  ok: boolean;

  /** Detected view type */
  detectedView: 'front' | 'side' | 'back' | '3q-front' | '3q-back' | 'unknown';

  /** Confidence score (0-1) */
  confidence: number;

  /** Reasons for classification */
  reasons?: string[];
}

/**
 * Variant generation attempt metadata
 */
export interface VariantAttempt {
  attemptNumber: number;
  imageUrl: string;
  validation: ViewValidation;
  timestamp: number;
}

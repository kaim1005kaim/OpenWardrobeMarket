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

/**
 * Design Tokens extracted from main image
 * Used to ensure SIDE/BACK variants maintain identical garment
 */
export interface DesignTokens {
  /** Garment type (coat, jacket, dress, etc.) */
  garment_type: string;

  /** Silhouette (boxy, cocoon, oversized, etc.) */
  silhouette: string;

  /** Length (long, midi, short) */
  length: string;

  /** Neckline (mandarin, notch, crew, etc.) */
  neckline: string;

  /** Sleeve type (long, short, sleeveless, raglan, etc.) */
  sleeve: string;

  /** Color palette as hex codes */
  palette_hex: string[];

  /** Materials list */
  materials: string[];

  /** Invariant details that must persist across views */
  invariant_details: string[];

  /** Seam map (panel/seam lines) */
  seam_map: string[];

  /** Trim details */
  trim: string[];

  /** Gradations/finishes */
  gradations: string[];

  /** Background style */
  bg_style: 'studio' | 'color' | 'color-grad';

  /** Demographic/model description */
  demographic: string;

  /** Generation seed for reproducibility */
  seed: number;

  /** Main image URL for reference */
  mainImageUrl: string;
}

/**
 * Variant metadata stored in generation_history
 */
export interface VariantMetadata {
  type: 'side' | 'back';
  r2_url: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  tries: number;
  view_conf?: number;
  sim_score?: number;
  error?: string;
}

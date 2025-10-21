/**
 * Type definitions for DNA-driven generation system
 */

/**
 * User answers from 6 questions
 */
export type Answers = {
  vibe: string[];
  silhouette: string[];
  fabric: string[];
  color: string[];
  occasion: string[];
  season: string[];
  extra?: string; // free text
};

/**
 * DNA parameters that control Urula appearance and generation
 * All values normalized to specific ranges
 */
export type DNA = {
  // Color parameters (0..1)
  hue: number;      // 0..1 (HSL hue normalized)
  sat: number;      // 0..1 (saturation)
  light: number;    // 0..1 (lightness)

  // Style axes (-1..1)
  minimal_maximal: number;   // -1=minimal, +1=maximal
  street_luxury: number;     // -1=street, +1=luxury
  oversized_fitted: number;  // -1=oversized, +1=fitted
  relaxed_tailored: number;  // -1=relaxed, +1=tailored

  // Texture (0..1)
  texture: number;           // 0=smooth, 1=strong vertical rib pattern
};

/**
 * Default DNA values (neutral starting point)
 * Displays as smooth glass-like metaballs with pale pink gradient
 */
export const DEFAULT_DNA: DNA = {
  hue: 0.95, // Pale pink (HSL ~342°)
  sat: 0.3, // Low saturation for soft color
  light: 0.75, // High lightness for pale appearance
  minimal_maximal: 0,
  street_luxury: 0,
  oversized_fitted: 0,
  relaxed_tailored: 0,
  texture: 0, // No texture = glass-like MeshTransmissionMaterial
};

/**
 * Create randomized DNA for diverse texture selection
 * Ensures users get varied textures across sessions
 */
export function createRandomDNA(): DNA {
  return {
    hue: Math.random(),
    sat: 0.4 + Math.random() * 0.4, // 0.4-0.8 for vibrant colors
    light: 0.4 + Math.random() * 0.3, // 0.4-0.7 for visible colors
    minimal_maximal: (Math.random() - 0.5) * 1.2, // -0.6 to 0.6
    street_luxury: (Math.random() - 0.5) * 1.2,
    oversized_fitted: (Math.random() - 0.5) * 1.2,
    relaxed_tailored: (Math.random() - 0.5) * 1.2,
    texture: Math.random(), // 0-1 for all 10 textures
  };
}

/**
 * Coach output from Gemini API
 */
export type GeminiCoachOut = {
  chips: string[];  // 3-6 short Japanese phrases
  ask?: {           // Optional follow-up question (max 1)
    id: string;
    title: string;
    options: string[];
  } | null;
  deltas: Array<{   // DNA adjustments from chips/answers
    key: keyof DNA;
    delta: number;  // -0.3..0.3
  }>;
  tags: string[];   // English tokens for prompt (filtered)
};

/**
 * DNA session stored in Supabase
 */
export type DNASession = {
  user_id: string;
  session_key: string;
  answers: Answers | null;
  free_text: string | null;
  gemini_tags: string[] | null;
  dna: DNA;
  prompt_preview: string | null;
  updated_at: string;
};

/**
 * Prompt composition result
 */
export type ComposedPrompt = {
  prompt: string;
  negatives: string;
  aspectRatio: string;
  quality: string;
  creativity: string;
  tags: string[];
};

/**
 * Asset with lineage support
 */
export type AssetWithLineage = {
  id: string;
  user_id: string;
  image_url: string;
  dna: DNA;
  lineage_tags: string[];
  parent_asset_id: string | null;
  is_public: boolean;
  created_at: string;
};

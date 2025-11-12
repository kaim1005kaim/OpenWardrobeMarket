/**
 * Diversity Control Utilities for FUSION Mode
 *
 * Implements silhouette cooldown, demographic sampling, and background variation
 * to ensure diverse and high-quality fashion outputs.
 */

// Silhouette types supported
export const SILHOUETTES = [
  "tailored",
  "A-line",
  "boxy",
  "column",
  "mermaid",
  "parachute",
  "cocoon",
  "oversized"
] as const;

export type Silhouette = typeof SILHOUETTES[number];

// Demographic distribution configuration
export interface DemographicConfig {
  asian: number;
  white: number;
  black: number;
  other: number;
}

export const DEFAULT_DEMOGRAPHIC_DISTRIBUTION: DemographicConfig = {
  asian: 0.70,
  white: 0.15,
  black: 0.10,
  other: 0.05
};

// Background type distribution
export interface BackgroundConfig {
  color: number;
  white: number;
}

export const DEFAULT_BACKGROUND_DISTRIBUTION: BackgroundConfig = {
  color: 0.70,
  white: 0.30
};

/**
 * Apply cooldown to reduce frequency of recently used items
 * @param items - Array of possible items (e.g., silhouettes)
 * @param recentHistory - Recently used items (most recent first)
 * @param options - Cooldown configuration
 * @returns Weighted map with cooldown applied
 */
export function applyCooldown<T extends string>(
  items: readonly T[],
  recentHistory: T[],
  options: {
    window?: number;      // How many recent items to consider (default: 5)
    factor?: number;      // Penalty factor for same item (default: 0.35)
  } = {}
): Map<T, number> {
  const { window = 5, factor = 0.35 } = options;

  // Initialize with equal weights
  const weights = new Map<T, number>();
  items.forEach(item => weights.set(item, 1.0));

  // Apply penalty to recently used items
  const recentWindow = recentHistory.slice(0, window);
  const counts = new Map<T, number>();

  recentWindow.forEach(item => {
    counts.set(item, (counts.get(item) || 0) + 1);
  });

  counts.forEach((count, item) => {
    if (count >= 2) {
      // Heavy penalty if same item appears 2+ times in recent window
      const currentWeight = weights.get(item) || 1.0;
      weights.set(item, currentWeight * factor);
    }
  });

  return weights;
}

/**
 * Sample from weighted distribution using softmax with temperature
 * @param weights - Map of items to weights
 * @param options - Sampling configuration
 * @returns Selected item
 */
export function sampleTopKSoftmax<T extends string>(
  weights: Map<T, number>,
  options: {
    k?: number;          // Top-k items to consider (default: 4)
    temperature?: number; // Temperature for softmax (default: 0.85)
  } = {}
): T {
  const { k = 4, temperature = 0.85 } = options;

  // Sort by weight and take top-k
  const sorted = Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);

  // Apply softmax with temperature
  const scaled = sorted.map(([item, weight]) => ({
    item,
    score: Math.exp(weight / temperature)
  }));

  const total = scaled.reduce((sum, { score }) => sum + score, 0);
  const probabilities = scaled.map(({ item, score }) => ({
    item,
    probability: score / total
  }));

  // Sample
  const rand = Math.random();
  let cumulative = 0;

  for (const { item, probability } of probabilities) {
    cumulative += probability;
    if (rand <= cumulative) {
      return item;
    }
  }

  // Fallback to last item (shouldn't happen)
  return probabilities[probabilities.length - 1].item;
}

/**
 * Sample demographic based on configured distribution
 * @param distribution - Demographic probability distribution
 * @param seed - Optional seed for deterministic sampling (e.g., userId + timestamp)
 * @returns Demographic category
 */
export function sampleDemographic(
  distribution: DemographicConfig = DEFAULT_DEMOGRAPHIC_DISTRIBUTION,
  seed?: string
): keyof DemographicConfig {
  const rand = seed ? seededRandom(seed) : Math.random();

  let cumulative = 0;
  const demos: (keyof DemographicConfig)[] = ['asian', 'white', 'black', 'other'];

  for (const demo of demos) {
    cumulative += distribution[demo];
    if (rand <= cumulative) {
      return demo;
    }
  }

  return 'asian'; // Fallback
}

/**
 * Generate demographic prompt phrase
 * @param demographic - Demographic category
 * @returns Prompt phrase for model description
 */
export function demographicToPrompt(demographic: keyof DemographicConfig): string {
  const phrases = {
    asian: "model of East Asian descent, 20s, androgynous elegance",
    white: "model of European descent, 20s, androgynous elegance",
    black: "model of African descent, 20s, androgynous elegance",
    other: "model of South Asian descent, 20s, androgynous elegance"
  };

  return phrases[demographic];
}

/**
 * Sample background type based on configured distribution
 * @param distribution - Background probability distribution
 * @returns Background type
 */
export function sampleBackground(
  distribution: BackgroundConfig = DEFAULT_BACKGROUND_DISTRIBUTION
): 'color' | 'white' {
  const rand = Math.random();
  return rand < distribution.color ? 'color' : 'white';
}

/**
 * Generate background prompt from palette
 * @param backgroundType - 'color' or 'white'
 * @param palette - Array of hex colors from analysis
 * @returns Background prompt phrase
 */
export function backgroundToPrompt(
  backgroundType: 'color' | 'white',
  palette: string[]
): string {
  if (backgroundType === 'white') {
    return "pure white studio cyclorama, minimal, clean";
  }

  // Pick a color from palette and desaturate/lighten for soft background
  const baseColor = palette[Math.floor(Math.random() * palette.length)];

  // Convert hex to descriptive color name for more natural prompt
  const colorName = hexToColorName(baseColor);

  return `studio cyclorama, soft gradient background in muted ${colorName}, subtle lighting`;
}

/**
 * Simple hex to color name converter
 * @param hex - Hex color code
 * @returns Descriptive color name
 */
function hexToColorName(hex: string): string {
  // Remove # if present
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  // Simple hue-based naming
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max - min < 30) {
    // Grayscale
    if (max > 200) return "light gray";
    if (max > 100) return "gray";
    return "dark gray";
  }

  if (r > g && r > b) {
    if (g > b + 30) return "orange";
    return "red";
  }
  if (g > r && g > b) {
    if (b > r + 30) return "cyan";
    return "green";
  }
  if (b > r && b > g) {
    if (r > g + 30) return "purple";
    return "blue";
  }

  return "neutral";
}

/**
 * Seeded random number generator for deterministic sampling
 * @param seed - String seed
 * @returns Random number between 0 and 1
 */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Simple LCG (Linear Congruential Generator)
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);

  hash = Math.abs(hash);
  const next = (a * hash + c) % m;

  return next / m;
}

/**
 * Format silhouette for prompt usage
 * @param silhouette - Silhouette type
 * @returns Formatted string for prompt
 */
export function formatSilhouetteForPrompt(silhouette: Silhouette): string {
  return `${silhouette} silhouette`;
}

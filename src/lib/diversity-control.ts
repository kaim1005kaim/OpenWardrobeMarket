/**
 * Diversity Control Utilities for FUSION Mode
 *
 * Implements silhouette cooldown, demographic sampling, and background variation
 * to ensure diverse and high-quality fashion outputs.
 *
 * Updated to support 12-16 silhouettes and detailed JP/KR demographic sampling.
 */

import {
  SILHOUETTES,
  MODEL_WEIGHTS,
  NO_MODEL_PROBABILITY,
  COOLDOWN_CONFIG,
  SAMPLING_CONFIG,
  BACKGROUND_CONFIG,
  getAllModelWeights,
  demographicPhrase,
  silhouetteDescription,
  getBaseSilhouetteWeights,
  type Silhouette,
  type DemographicKey
} from './diversity-config';

export type { Silhouette, DemographicKey };
export { SILHOUETTES };

// Legacy interfaces for backward compatibility
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
    factor?: number;      // Penalty factor per occurrence (default: 0.35)
  } = {}
): Map<T, number> {
  const { window = COOLDOWN_CONFIG.window, factor = COOLDOWN_CONFIG.factor } = options;

  // Initialize with equal weights
  const weights = new Map<T, number>();
  items.forEach(item => weights.set(item, 1.0));

  // Count occurrences in recent window
  const recentWindow = recentHistory.slice(0, window);
  const counts = new Map<T, number>();

  recentWindow.forEach(item => {
    counts.set(item, (counts.get(item) || 0) + 1);
  });

  // Apply exponential penalty: weight = weight * (factor^count)
  counts.forEach((count, item) => {
    const currentWeight = weights.get(item) || 1.0;
    weights.set(item, currentWeight * Math.pow(factor, count));
  });

  return weights;
}

/**
 * Sample from weighted distribution using softmax with temperature
 * @param weights - Map of items to weights
 * @param options - Sampling configuration
 * @param seed - Optional seed for deterministic sampling
 * @returns Selected item
 */
export function sampleTopKSoftmax<T extends string>(
  weights: Map<T, number>,
  options: {
    k?: number;          // Top-k items to consider (default: 4)
    temperature?: number; // Temperature for softmax (default: 0.85)
    seed?: string;       // Seed for deterministic sampling
  } = {}
): T {
  const { k = SAMPLING_CONFIG.topK, temperature = SAMPLING_CONFIG.temperature, seed } = options;

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

  // Sample (with optional seed for deterministic behavior)
  const rand = seed ? seededRandom(seed) : Math.random();
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
 * Sample demographic based on configured distribution (LEGACY)
 * @deprecated Use sampleDetailedDemographic instead
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
 * Sample detailed demographic from JP/KR-focused distribution
 * @param seed - Optional seed for deterministic sampling
 * @param gender - Optional gender filter ('mens' or 'womens')
 * @returns Detailed demographic key (e.g., "jp_f_20s")
 */
export function sampleDetailedDemographic(seed?: string, gender?: 'mens' | 'womens'): DemographicKey {
  let weights = getAllModelWeights();

  // Filter by gender if specified
  if (gender) {
    const filteredWeights: Record<string, number> = {};
    let totalWeight = 0;

    // Filter for only JP/KR demographics matching the gender
    Object.entries(weights).forEach(([key, weight]) => {
      const isMale = key.includes('_m_');
      const isFemale = key.includes('_f_');
      const isJpKr = key.startsWith('jp_') || key.startsWith('kr_');

      if (isJpKr) {
        if ((gender === 'mens' && isMale) || (gender === 'womens' && isFemale)) {
          filteredWeights[key] = weight;
          totalWeight += weight;
        }
      }
    });

    // Normalize weights to sum to 1.0
    if (totalWeight > 0) {
      Object.keys(filteredWeights).forEach(key => {
        filteredWeights[key] = filteredWeights[key] / totalWeight;
      });
      weights = filteredWeights as Record<DemographicKey, number>;
    }

    console.log('[sampleDetailedDemographic] Filtered weights for gender:', gender, filteredWeights);
  }

  const rand = seed ? seededRandom(seed) : Math.random();

  console.log('[sampleDetailedDemographic] Random value:', rand, 'Seed:', seed, 'Gender:', gender);

  let cumulative = 0;
  const entries = Object.entries(weights) as [DemographicKey, number][];

  for (const [key, weight] of entries) {
    cumulative += weight;
    console.log(`[sampleDetailedDemographic] Checking ${key}: weight=${weight}, cumulative=${cumulative}, rand=${rand}`);
    if (rand <= cumulative) {
      console.log(`[sampleDetailedDemographic] Selected:`, key);
      return key;
    }
  }

  // Fallback based on gender
  const fallback = gender === 'mens' ? 'jp_m_20s' : 'jp_f_20s';
  console.log('[sampleDetailedDemographic] Fallback to', fallback);
  return fallback;
}

/**
 * Generate model phrase with "no model" probability support
 * @param seed - Optional seed for deterministic sampling
 * @param gender - Optional gender filter ('mens' or 'womens')
 * @returns Model phrase or "no visible model"
 */
export function sampleModelPhrase(seed?: string, gender?: 'mens' | 'womens'): string {
  const rand = seed ? seededRandom(seed + '_nomodel') : Math.random();

  if (rand < NO_MODEL_PROBABILITY) {
    return "no visible model, garment-only composition, product-forward presentation, styled on invisible form";
  }

  const demoKey = sampleDetailedDemographic(seed, gender);
  return demographicPhrase(demoKey);
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
 * @param seed - Optional seed for deterministic sampling
 * @returns Background type
 */
export function sampleBackground(
  distribution: BackgroundConfig = DEFAULT_BACKGROUND_DISTRIBUTION,
  seed?: string
): 'color' | 'white' {
  const rand = seed ? seededRandom(seed + '_bg') : Math.random();
  const threshold = BACKGROUND_CONFIG.colorProbability;
  return rand < threshold ? 'color' : 'white';
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

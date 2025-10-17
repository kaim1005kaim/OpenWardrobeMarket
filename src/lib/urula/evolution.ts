/**
 * Urula evolution algorithm
 * Learns from user preferences and adapts appearance
 */

import type { UserUrulaProfile, EvolutionInput, MaterialWeights, Tint } from '../../types/urula';

// Material learning rules: tag → material weight deltas
const MAT_RULES: Record<string, Partial<MaterialWeights>> = {
  leather: { leather: 0.08 },
  denim: { denim: 0.08 },
  pinstripe: { pinstripe: 0.08 },
  canvas: { canvas: 0.06 },
  // Fallback mappings
  tailored: { pinstripe: 0.04 },
  workwear: { canvas: 0.04, denim: 0.04 },
  street: { denim: 0.06 },
  luxury: { leather: 0.06, pinstripe: 0.02 },
  luxe: { leather: 0.06 },
  classic: { pinstripe: 0.04 },
  work: { canvas: 0.03, denim: 0.03 },
};

/**
 * Apply tag deltas to material weights
 */
function applyTagDeltas(
  weights: MaterialWeights,
  tags: string[],
  learnRate: number
): MaterialWeights {
  const newWeights = { ...weights };

  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    const delta = MAT_RULES[tagLower];

    if (delta) {
      for (const [mat, value] of Object.entries(delta)) {
        if (mat in newWeights) {
          newWeights[mat as keyof MaterialWeights] += value * learnRate;
        }
      }
    }
  }

  return newWeights;
}

/**
 * Normalize material weights to sum to 1.0 (L1 normalization)
 */
function normalizeWeights(weights: MaterialWeights): MaterialWeights {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;

  return {
    canvas: Math.max(0, weights.canvas / sum),
    denim: Math.max(0, weights.denim / sum),
    leather: Math.max(0, weights.leather / sum),
    pinstripe: Math.max(0, weights.pinstripe / sum),
  };
}

/**
 * Exponential moving average for tint
 */
function emaTint(current: Tint, newColor: Tint, alpha: number): Tint {
  return {
    h: current.h * (1 - alpha) + newColor.h * alpha,
    s: current.s * (1 - alpha) + newColor.s * alpha,
    l: current.l * (1 - alpha) + newColor.l * alpha,
  };
}

/**
 * Average colors in HSL space
 */
function averageColors(colors: Array<{ h: number; s: number; l: number }>): Tint {
  if (colors.length === 0) return { h: 160, s: 0.25, l: 0.75 };

  const sum = colors.reduce(
    (acc, c) => ({
      h: acc.h + c.h,
      s: acc.s + c.s,
      l: acc.l + c.l,
    }),
    { h: 0, s: 0, l: 0 }
  );

  return {
    h: sum.h / colors.length,
    s: sum.s / colors.length,
    l: sum.l / colors.length,
  };
}

/**
 * Update palette with new colors
 */
function updatePalette(
  currentPalette: UserUrulaProfile['palette'],
  newColors: Array<{ name: string; h: number; s: number; l: number }>
): UserUrulaProfile['palette'] {
  if (newColors.length === 0) return currentPalette;

  // Take first color as main if significantly different
  const firstColor = newColors[0];
  const main: [number, number, number] = [firstColor.h, firstColor.s, firstColor.l];

  // Add up to 3 distinct colors as accents
  const accents: Array<[number, number, number]> = newColors
    .slice(1, 4)
    .map((c) => [c.h, c.s, c.l] as [number, number, number]);

  return { main, accents };
}

/**
 * Calculate glass_gene adjustment based on material bias
 */
function calculateGlassDelta(tags: string[], learnRate: number): number {
  let pinstripeLeather = 0;
  let denimCanvas = 0;

  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (['pinstripe', 'leather', 'tailored', 'luxury', 'luxe', 'classic'].includes(tagLower)) {
      pinstripeLeather++;
    }
    if (['denim', 'canvas', 'street', 'work', 'workwear'].includes(tagLower)) {
      denimCanvas++;
    }
  }

  return 0.02 * learnRate * (pinstripeLeather - denimCanvas);
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Main evolution function
 */
export function evolveProfile(
  profile: UserUrulaProfile,
  input: EvolutionInput
): UserUrulaProfile {
  const { styleTags, colors, signals } = input;

  // Calculate learning rate based on signals
  const learnRate =
    1 +
    0.25 *
      (+(signals.liked ?? false) +
        2 * +(signals.published ?? false) +
        0.5 * +(signals.keep ?? false));

  // Apply tag deltas to material weights
  let newWeights = applyTagDeltas(profile.mat_weights, styleTags, learnRate);
  newWeights = normalizeWeights(newWeights);

  // Update tint with EMA
  const avgColor = averageColors(colors);
  const newTint = emaTint(profile.tint, avgColor, 0.25);

  // Update palette
  const newPalette = updatePalette(profile.palette, colors);

  // Adjust glass_gene
  const glassDelta = calculateGlassDelta(styleTags, learnRate);
  const newGlassGene = clamp(profile.glass_gene + glassDelta, 0, 1);

  // Clamp chaos
  const newChaos = clamp(profile.chaos, 0.2, 0.6);

  // Update history
  const newHistory = {
    generations: profile.history.generations + 1,
    likes: profile.history.likes + (signals.liked ? 1 : 0),
    publishes: profile.history.publishes + (signals.published ? 1 : 0),
    lastTags: styleTags.slice(0, 10), // Keep last 10 tags
    lastColors: colors.slice(0, 5), // Keep last 5 colors
  };

  return {
    ...profile,
    mat_weights: newWeights,
    glass_gene: newGlassGene,
    chaos: newChaos,
    tint: newTint,
    palette: newPalette,
    history: newHistory,
    updated_at: new Date().toISOString(),
  };
}

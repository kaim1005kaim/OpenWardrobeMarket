/**
 * Urula evolution algorithm
 * Learns from user preferences and adapts appearance
 */

import type { UserUrulaProfile, EvolutionInput, MaterialWeights, Tint } from '../../types/urula';

// Material learning rules: tag → material weight deltas
// Increased deltas for faster visual evolution
const MAT_RULES: Record<string, Partial<MaterialWeights>> = {
  // Direct material mappings (very strong - exact matches)
  leather: { leather: 0.35 },
  denim: { denim: 0.35 },
  pinstripe: { pinstripe: 0.35 },
  canvas: { canvas: 0.35 },
  silk: { satin_silk: 0.35 },
  satin: { satin_silk: 0.35 },
  velvet: { velvet: 0.35 },
  suede: { suede: 0.35 },
  wool: { wool: 0.35 },
  ripstop: { ripstop: 0.35 },

  // Style mappings (strong)
  luxury: { leather: 0.20, velvet: 0.15, satin_silk: 0.15 },
  luxe: { velvet: 0.20, satin_silk: 0.15, leather: 0.10 },
  formal: { pinstripe: 0.20, wool: 0.15 },
  tailored: { pinstripe: 0.20, wool: 0.10 },
  classic: { pinstripe: 0.15, wool: 0.12 },
  elegant: { satin_silk: 0.18, velvet: 0.15, leather: 0.10 },

  street: { denim: 0.25, ripstop: 0.12 },
  casual: { denim: 0.20, canvas: 0.12 },
  urban: { denim: 0.15, ripstop: 0.10 },

  workwear: { canvas: 0.20, ripstop: 0.15 },
  work: { canvas: 0.15, wool: 0.10 },
  utility: { canvas: 0.15, ripstop: 0.12 },
  outdoor: { canvas: 0.12, ripstop: 0.15 },

  // Fabric-related styles
  flowing: { satin_silk: 0.20, velvet: 0.12 },
  structured: { canvas: 0.15, wool: 0.12 },
  soft: { velvet: 0.18, suede: 0.15 },
  textured: { suede: 0.18, wool: 0.12 },
  smooth: { satin_silk: 0.20, leather: 0.10 },

  // Seasonal/occasion (medium)
  summer: { canvas: 0.10, ripstop: 0.08 },
  winter: { wool: 0.15, velvet: 0.12, leather: 0.10 },
  spring: { satin_silk: 0.10, canvas: 0.08 },
  fall: { wool: 0.12, suede: 0.10 },
  business: { pinstripe: 0.15, wool: 0.12 },
  party: { velvet: 0.15, satin_silk: 0.12, leather: 0.08 },
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
 * Normalize material weights with dominant material emphasis (80/20 rule)
 * The strongest material gets amplified to maintain visual clarity
 */
function normalizeWeights(weights: MaterialWeights): MaterialWeights {
  // Sort materials by weight
  const sorted = Object.entries(weights)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // If there's a clear dominant material (>30%), emphasize it
  const dominant = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  if (dominant.value > 0.3) {
    // Apply 70/20/10 rule: dominant gets majority, top 2-3 materials share rest
    const total = dominant.value + second.value + (third?.value || 0);
    const dominantRatio = Math.max(0.5, Math.min(0.8, dominant.value / total));
    const secondRatio = Math.max(0.15, (1 - dominantRatio) * 0.6);
    const thirdRatio = 1 - dominantRatio - secondRatio;

    const result = {
      canvas: 0,
      denim: 0,
      glassribpattern: 0,
      leather: 0,
      pinstripe: 0,
      ripstop: 0,
      satin_silk: 0,
      suede: 0,
      velvet: 0,
      wool: 0,
    } as MaterialWeights;

    result[dominant.name as keyof MaterialWeights] = dominantRatio;
    result[second.name as keyof MaterialWeights] = secondRatio;
    if (third && thirdRatio > 0.05) {
      result[third.name as keyof MaterialWeights] = thirdRatio;
    }

    return result;
  }

  // Otherwise use standard normalization
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;

  return {
    canvas: Math.max(0, weights.canvas / sum),
    denim: Math.max(0, weights.denim / sum),
    glassribpattern: Math.max(0, weights.glassribpattern / sum),
    leather: Math.max(0, weights.leather / sum),
    pinstripe: Math.max(0, weights.pinstripe / sum),
    ripstop: Math.max(0, weights.ripstop / sum),
    satin_silk: Math.max(0, weights.satin_silk / sum),
    suede: Math.max(0, weights.suede / sum),
    velvet: Math.max(0, weights.velvet / sum),
    wool: Math.max(0, weights.wool / sum),
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

  // Calculate base learning rate based on signals
  let learnRate =
    1 +
    0.25 *
      (+(signals.liked ?? false) +
        2 * +(signals.published ?? false) +
        0.5 * +(signals.keep ?? false));

  // Initial generation boost: 3x for first generation, gradually decreases
  const isFirstGeneration = profile.history.generations === 0;
  if (isFirstGeneration) {
    learnRate *= 3.0; // 初回は3倍ブースト
  } else if (profile.history.generations < 5) {
    // 2-5回目は徐々に減衰（2.5x → 2.0x → 1.5x → 1.0x）
    const decayFactor = 2.5 - (profile.history.generations - 1) * 0.5;
    learnRate *= Math.max(1.0, decayFactor);
  }

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

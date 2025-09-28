/**
 * Vector operations for CLIP embeddings and Style Subtractor
 */

export type Vec = number[];

/**
 * Dot product of two vectors
 */
export const dot = (a: Vec, b: Vec): number => {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
};

/**
 * Euclidean norm (magnitude) of a vector
 */
export const norm = (a: Vec): number => {
  return Math.sqrt(dot(a, a));
};

/**
 * Cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical direction)
 */
export const cosineSimilarity = (a: Vec, b: Vec): number => {
  const normA = norm(a);
  const normB = norm(b);
  
  if (normA === 0 || normB === 0) {
    return 0; // Handle zero vectors
  }
  
  return dot(a, b) / (normA * normB);
};

/**
 * Style Subtractor: Remove projection of vector x onto mu
 * x' = x - ((x·μ)/(μ·μ)) * μ
 * This creates a vector orthogonal to the heritage style
 */
export const styleSubtractor = (x: Vec, mu: Vec, ratio: number = 1.0): Vec => {
  if (x.length !== mu.length) {
    throw new Error('Vectors must have same dimension');
  }
  
  const muDotMu = dot(mu, mu);
  
  if (muDotMu === 0) {
    return x; // If mu is zero vector, return x unchanged
  }
  
  const projectionCoeff = (dot(x, mu) / muDotMu) * ratio;
  
  return x.map((val, i) => val - projectionCoeff * mu[i]);
};

/**
 * Calculate diversity among a group of vectors
 * Returns average of (1 - cosine similarity) for all pairs
 */
export const calculateDiversity = (vectors: Vec[]): number => {
  if (vectors.length < 2) {
    return 0;
  }
  
  let pairCount = 0;
  let diversitySum = 0;
  
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      diversitySum += (1 - cosineSimilarity(vectors[i], vectors[j]));
      pairCount++;
    }
  }
  
  return pairCount > 0 ? diversitySum / pairCount : 0;
};

/**
 * Find maximum cosine similarity to any vector in corpus
 */
export const maxSimilarityToCorpus = (x: Vec, corpus: Vec[]): number => {
  if (corpus.length === 0) {
    return 0;
  }
  
  return Math.max(...corpus.map(y => cosineSimilarity(x, y)));
};

/**
 * Calculate Novelty Index
 * Combines external dissimilarity and internal diversity
 */
export const calculateNoveltyScore = (
  x: Vec,
  corpus: Vec[],
  groupVectors: Vec[]
): number => {
  // External novelty: how different from existing corpus
  const maxCorpusSimilarity = maxSimilarityToCorpus(x, corpus);
  const externalNovelty = 1 - maxCorpusSimilarity;
  
  // Internal diversity: how different within the same generation batch
  const internalDiversity = calculateDiversity(groupVectors);
  
  // Weighted combination: 60% external, 40% internal
  return 0.6 * externalNovelty + 0.4 * internalDiversity;
};

/**
 * Calculate mean vector from a set of vectors
 * Used for creating heritage cluster centers
 */
export const calculateMeanVector = (vectors: Vec[]): Vec => {
  if (vectors.length === 0) {
    throw new Error('Cannot calculate mean of empty vector set');
  }
  
  const dimension = vectors[0].length;
  const mean = new Array(dimension).fill(0);
  
  // Sum all vectors
  for (const vec of vectors) {
    if (vec.length !== dimension) {
      throw new Error('All vectors must have same dimension');
    }
    for (let i = 0; i < dimension; i++) {
      mean[i] += vec[i];
    }
  }
  
  // Divide by count
  return mean.map(val => val / vectors.length);
};

/**
 * Normalize vector to unit length
 */
export const normalize = (vec: Vec): Vec => {
  const n = norm(vec);
  if (n === 0) {
    return vec;
  }
  return vec.map(val => val / n);
};

/**
 * Linear interpolation between two vectors
 * ratio = 0 returns a, ratio = 1 returns b
 */
export const lerp = (a: Vec, b: Vec, ratio: number): Vec => {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }
  
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return a.map((val, i) => val * (1 - clampedRatio) + b[i] * clampedRatio);
};

/**
 * Apply heritage influence to a vector
 * Blends towards heritage cluster based on ratio
 */
export const applyHeritageInfluence = (
  x: Vec,
  heritageVector: Vec,
  ratio: number
): Vec => {
  return lerp(x, heritageVector, ratio);
};

/**
 * Check if vector is valid (no NaN or Infinity values)
 */
export const isValidVector = (vec: Vec): boolean => {
  return vec.every(val => Number.isFinite(val));
};

/**
 * Safe vector operation wrapper
 * Returns fallback value if operation fails
 */
export const safeVectorOp = <T>(
  operation: () => T,
  fallback: T,
  errorMessage?: string
): T => {
  try {
    const result = operation();
    return result;
  } catch (error) {
    console.error(errorMessage || 'Vector operation failed:', error);
    return fallback;
  }
};
/**
 * Type definitions for Urula adaptive appearance system
 */

export interface MaterialWeights {
  canvas: number;
  denim: number;
  glassribpattern: number;
  leather: number;
  pinstripe: number;
  ripstop: number;
  satin_silk: number;
  suede: number;
  velvet: number;
  wool: number;
}

export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export interface Tint extends HSLColor {}

export interface Palette {
  main: [number, number, number]; // HSL tuple
  accents: Array<[number, number, number]>; // HSL tuples
}

export interface UrulaHistory {
  generations: number;
  likes: number;
  publishes: number;
  lastTags: string[];
  lastColors: Array<{ name: string; h: number; s: number; l: number }>;
}

export interface UserUrulaProfile {
  user_id: string;
  mat_weights: MaterialWeights;
  glass_gene: number; // 0..1
  chaos: number; // 0.2..0.6
  tint: Tint;
  palette: Palette;
  history: UrulaHistory;
  updated_at: string;
}

export interface EvolutionInput {
  styleTags: string[];
  colors: Array<{ name: string; h: number; s: number; l: number }>;
  signals: {
    liked?: boolean;
    published?: boolean;
    keep?: boolean;
  };
}

export const DEFAULT_URULA_PROFILE: Omit<UserUrulaProfile, 'user_id' | 'updated_at'> = {
  mat_weights: {
    canvas: 0.1,
    denim: 0.1,
    glassribpattern: 0.1,
    leather: 0.1,
    pinstripe: 0.1,
    ripstop: 0.1,
    satin_silk: 0.1,
    suede: 0.1,
    velvet: 0.1,
    wool: 0.1,
  },
  glass_gene: 0.5,
  chaos: 0.35,
  tint: { h: 160, s: 0.25, l: 0.75 },
  palette: {
    main: [160, 0.25, 0.75],
    accents: [],
  },
  history: {
    generations: 0,
    likes: 0,
    publishes: 0,
    lastTags: [],
    lastColors: [],
  },
};

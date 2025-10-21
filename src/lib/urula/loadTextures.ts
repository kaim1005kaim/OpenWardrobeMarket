import * as THREE from 'three';
import type { MaterialWeights } from '../../types/urula';

export interface MaterialTextures {
  albedo: THREE.Texture;
  normal: THREE.Texture;
}

export interface TextureSet {
  canvas: MaterialTextures;
  denim: MaterialTextures;
  glassrib: MaterialTextures;
  leather: MaterialTextures;
  pinstripe: MaterialTextures;
  ripstop: MaterialTextures;
  satin_silk: MaterialTextures;
  suede: MaterialTextures;
  velvet: MaterialTextures;
  wool: MaterialTextures;
}

const ALIASES = {
  canvas: {
    albedo: '/texture/Canvas_albedo.png',
    normal: '/texture/Canvas_nomal.png'
  },
  denim: {
    albedo: '/texture/Denim_albedo.png',
    normal: '/texture/Denim_nomal.png'
  },
  glassrib: {
    albedo: '/texture/Glassribpattern_albedo.png',
    normal: '/texture/Glassribpattern_nomal.png'
  },
  leather: {
    albedo: '/texture/Leather_albedo.png',
    normal: '/texture/Leather_nomal.png'
  },
  pinstripe: {
    albedo: '/texture/Pinstripe_albedo.png',
    normal: '/texture/Pinstripe_nomal.png'
  },
  ripstop: {
    albedo: '/texture/Ripstop_albedo.png',
    normal: '/texture/Ripstop_nomal.png'
  },
  satin_silk: {
    albedo: '/texture/Satin_Silk_albedo.png',
    normal: '/texture/Satin_Silk_nomal.png'
  },
  suede: {
    albedo: '/texture/Suede_albedo.png',
    normal: '/texture/Suede_nomal.png'
  },
  velvet: {
    albedo: '/texture/Velvet_albedo.png',
    normal: '/texture/Velvet_nomal.png'
  },
  wool: {
    albedo: '/texture/Wool_albedo.png',
    normal: '/texture/Wool_nomal.png'
  }
};

let cachedTextures: TextureSet | null = null;

/**
 * Load all Urula material textures
 * Returns cached result on subsequent calls
 */
export async function loadUrulaTextures(): Promise<TextureSet> {
  if (cachedTextures) {
    return cachedTextures;
  }

  const loader = new THREE.TextureLoader();

  // Load all textures in parallel
  const loadPromises = Object.entries(ALIASES).map(async ([material, paths]) => {
    const [albedo, normal] = await Promise.all([
      loader.loadAsync(paths.albedo),
      loader.loadAsync(paths.normal)
    ]);

    // Configure texture settings
    [albedo, normal].forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
    });

    return [material, { albedo, normal }] as const;
  });

  const results = await Promise.all(loadPromises);

  cachedTextures = Object.fromEntries(results) as unknown as TextureSet;

  return cachedTextures;
}

/**
 * Get top 2 materials by weight
 */
export function getTopMaterials(weights: MaterialWeights | Record<string, number>): string[] {
  const sorted = Object.entries(weights as Record<string, number>)
    .sort(([, a], [, b]) => b - a);

  return sorted.slice(0, 2).map(([name]) => name);
}

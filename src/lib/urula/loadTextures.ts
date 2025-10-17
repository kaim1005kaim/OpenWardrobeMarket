import * as THREE from 'three';

export interface MaterialTextures {
  albedo: THREE.Texture;
  normal: THREE.Texture;
}

export interface TextureSet {
  canvas: MaterialTextures;
  denim: MaterialTextures;
  leather: MaterialTextures;
  pinstripe: MaterialTextures;
  glassrib: MaterialTextures;
}

const ALIASES = {
  canvas: {
    albedo: '/texture/Canvas_albedo.webp',
    normal: '/texture/Canvas_nomal.png'
  },
  denim: {
    albedo: '/texture/Denim_albedo.webp',
    normal: '/texture/Denim_nomal.png'
  },
  leather: {
    albedo: '/texture/Leather_albedo.webp',
    normal: '/texture/Leather_nomal.png'
  },
  pinstripe: {
    albedo: '/texture/Pinstripe_albedo.webp',
    normal: '/texture/Pinstripe_nomal.png'
  },
  glassrib: {
    albedo: '/texture/Glassribpattern_albedo.webp',
    normal: '/texture/Glassribpattern_nomal.png'
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

  cachedTextures = Object.fromEntries(results) as TextureSet;

  return cachedTextures;
}

/**
 * Get top 2 materials by weight
 */
export function getTopMaterials(weights: Record<string, number>): [string, number][] {
  const sorted = Object.entries(weights)
    .sort(([, a], [, b]) => b - a);

  return sorted.slice(0, 2) as [string, number][];
}

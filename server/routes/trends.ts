import { Router } from 'express';

export const trendsRoutes = Router();

// Base presets from the existing data
const BASE_PRESETS = [
  { id: "street_black", label: "ストリート黒", vibe: "street", palette: "black", silhouette: "oversized", season: "aw" },
  { id: "soft_minimal", label: "ソフトミニマル", vibe: "minimal", palette: "monochrome", silhouette: "relaxed", season: "ss" },
  { id: "outdoor_earth", label: "アウトドア土色", vibe: "outdoor", palette: "earth", silhouette: "straight", season: "ss" },
  { id: "tech_neon", label: "テック×ネオン", vibe: "techwear", palette: "neon", silhouette: "tailored", season: "aw" },
  { id: "retro_navy", label: "レトロネイビー", vibe: "retro", palette: "navy", silhouette: "cropped", season: "pre-fall" },
];

const VIBES = ["minimal", "street", "luxury", "outdoor", "workwear", "athleisure", "retro", "avantgarde", "techwear"];
const PALETTES = ["black", "white", "navy", "earth", "pastel", "neon", "monochrome"];
const SILHOUETTES = ["tailored", "oversized", "relaxed", "straight", "flare", "cropped"];
const SEASONS = ["ss", "aw", "resort", "pre-fall"];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDailyPreset(): any {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Use date as seed for deterministic randomness (same preset for same day)
  const seed = today.split('-').map(n => parseInt(n)).reduce((a, b) => a + b, 0);
  Math.random = (() => {
    let x = Math.sin(seed) * 10000;
    return () => {
      x = Math.sin(x) * 10000;
      return x - Math.floor(x);
    };
  })();
  
  const vibe = getRandomItem(VIBES);
  const palette = getRandomItem(PALETTES);
  const silhouette = getRandomItem(SILHOUETTES);
  const season = getRandomItem(SEASONS);
  
  // Reset Math.random
  delete (Math as any).random;
  
  return {
    id: `auto_${today}_${vibe}_${palette}_${silhouette}_${season}`,
    label: "⚡今日のプリセット",
    vibe,
    palette,
    silhouette,
    season,
    sampleUrl: "", // TODO: Pre-generate sample image
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
  };
}

// GET /api/trends - Today's preset
trendsRoutes.get('/trends', async (req, res) => {
  try {
    const dailyPreset = generateDailyPreset();
    
    res.json([dailyPreset]);
    
  } catch (error: any) {
    console.error('[Trends API Error]:', error);
    res.status(500).json({ 
      error: 'Failed to get trends',
      message: error.message 
    });
  }
});
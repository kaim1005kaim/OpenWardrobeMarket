// プロンプト生成用のマッピング定義
export const VIBE_MAP: Record<string, string[]> = {
  minimal: ['clean lines', 'simple silhouette', 'neutral tones'],
  streetwear: ['oversized fit', 'graphic-lite', 'urban'],
  vintage: ['retro pattern', 'classic silhouette'],
  techwear: ['functional pockets', 'water-resistant', 'urban'],
  preppy: ['structured tailoring', 'classic pattern'],
  edgy: ['asymmetric design', 'bold cuts', 'avant-garde'],
  romantic: ['delicate details', 'flowing fabric', 'soft drape'],
  // 日本語マッピング
  'ミニマル': ['clean lines', 'simple silhouette', 'neutral tones'],
  'ストリート': ['oversized fit', 'urban', 'casual'],
  'エッジ': ['asymmetric design', 'bold', 'avant-garde'],
  'ロマン': ['delicate details', 'flowing', 'feminine']
};

export const PALETTE_MAP: Record<string, string[]> = {
  'monochrome': ['black', 'white', 'gray'],
  'pastel': ['soft pink', 'baby blue', 'lavender'],
  'earth-tone': ['terracotta', 'olive green', 'sand beige'],
  'jewel-tone': ['emerald', 'sapphire', 'ruby'],
  'neon': ['electric lime', 'neon pink'],
  'muted': ['dusty rose', 'sage'],
  // 日本語マッピング
  'モノクロ': ['black', 'white', 'gray'],
  'パステル': ['soft pink', 'baby blue', 'lavender'],
  'ニュートラル': ['beige', 'cream', 'taupe'],
  'ビビッド': ['bright red', 'electric blue', 'vibrant yellow']
};

export const SILHOUETTE_MAP: Record<string, string[]> = {
  'oversized': ['loose fit', 'relaxed', 'dropped shoulder'],
  'tailored': ['fitted', 'structured', 'clean lines'],
  'cropped': ['short length', 'high waist friendly'],
  'straight': ['regular fit', 'classic cut'],
  // 日本語マッピング
  'オーバーサイズ': ['loose fit', 'relaxed', 'dropped shoulder'],
  'テーラード': ['fitted', 'structured', 'clean lines'],
  'クロップド': ['cropped length', 'short cut'],
  'ストレート': ['regular fit', 'classic cut']
};

export const MOOD_MAP: Record<string, string> = {
  casual: 'relaxed fit, comfortable wear',
  formal: 'tailored precision, refined',
  edgy: 'asymmetric design, bold',
  romantic: 'delicate details, flowing',
  professional: 'clean structure, business-ready',
  'night-out': 'sleek, evening-ready',
  // 日本語
  'カジュアル': 'relaxed fit, comfortable wear',
  'フォーマル': 'tailored precision, refined',
  'ナイトアウト': 'sleek, evening-ready'
};

export const SIGNATURE_OPTIONS = [
  'quiet luxury',
  'neo-futurism',
  'soft tailoring',
  'genderless',
  'artisan texture',
  'understated elegance',
  'architectural',
  'minimalist luxury',
  'sustainable fashion',
  'avant-garde',
  'deconstructed',
  'asymmetric'
];

export const NEGATIVE_BASE = [
  'text',
  'words',
  'letters',
  'typography',
  'logos',
  'brands',
  'celebrities',
  'multiple people',
  'collage',
  'grid',
  'panels',
  'split screen',
  'comic style',
  'manga',
  'multiple angles',
  'contact sheet',
  'watermark',
  'signature'
];
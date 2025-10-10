/**
 * Design Tokens extracted from Figma
 * File: OPEN WARDROBE MARKET (iDk13GzboDmKCEBnjE3VAC)
 */

// Color Palette
export const colors = {
  // Primary
  black: '#000000',
  white: '#FFFFFF',

  // Backgrounds
  background: '#EEECE6',  // Main background (頻出40回)
  darkGreen: '#1C3C3D',   // Dark accent
  darkTeal: '#1E4042',    // Teal accent
  beige: '#CBC0A1',       // Warm beige

  // Grays
  lightGray: '#F5F5F5',
  mediumGray: '#E5E5E5',
  darkGray: '#666666',
} as const;

// Typography (Figmaから抽出)
export const fonts = {
  // Display fonts - 使用頻度順
  trajan: '"Trajan Pro 3", "Cinzel", serif',           // 412回使用: 24px(124), 13px(96), 12px(46)
  notoSans: '"Noto Sans JP", "Noto Sans CJK JP", sans-serif',  // 124回使用: 13px, 14px
  tradeGothic: '"Trade Gothic LT Pro", "Helvetica Neue", Arial, sans-serif', // 51回使用: 18px
  montserrat: '"Montserrat", sans-serif',               // 8回使用: 40px for headers
  majorMono: '"Major Mono Display", monospace',         // 4回使用: 12px

  // Poster用フォント
  monoton: '"Monoton", cursive',
  poiret: '"Poiret One", cursive',
  unbounded: '"Unbounded", cursive',

  // Fallback
  systemFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
} as const;

export const fontSizes = {
  // Figma使用頻度順
  // Trajan Pro 3: 24(124回), 13(96回), 12(46回), 68(19回), 26(20回), 10(31回), 7(31回)
  // Noto Sans: 13, 14
  // Trade Gothic: 18
  // Montserrat: 40

  hero: 68,      // 大見出し
  h1: 40,        // Montserrat見出し
  h2: 26,        // Trajan副見出し
  h3: 24,        // Trajan最頻出
  h4: 18,        // Trade Gothic
  body: 14,      // Noto Sans本文
  bodySmall: 13, // Trajan/Noto Sans小
  caption: 12,   // Trajan/Major Mono
  tiny: 10,      // Trajan
  micro: 7,      // Trajan最小
} as const;

// Poster Templates (Figma GALLERY cards analysis)
export interface PosterTemplate {
  id: number;
  bgColor: string;
  textColor: string;
  brandFont: string;
  titleFont: string;
  numberFont: string;
}

export const posterTemplates: PosterTemplate[] = [
  {
    id: 1,
    bgColor: colors.black,
    textColor: colors.white,
    brandFont: fonts.trajan,      // ブランド名はTrajan Pro 3
    titleFont: fonts.trajan,       // タイトルもTrajan Pro 3
    numberFont: fonts.majorMono,   // 番号はMajor Mono Display
  },
  {
    id: 2,
    bgColor: '#FF8C42', // Orange
    textColor: colors.black,
    brandFont: fonts.trajan,
    titleFont: fonts.monoton,      // アクセント用
    numberFont: fonts.trajan,
  },
  {
    id: 3,
    bgColor: '#C73E1D', // Red-brown
    textColor: '#FFE66D', // Yellow
    brandFont: fonts.trajan,
    titleFont: fonts.trajan,
    numberFont: fonts.trajan,
  },
  {
    id: 4,
    bgColor: colors.white,
    textColor: colors.black,
    brandFont: fonts.trajan,
    titleFont: fonts.trajan,
    numberFont: fonts.majorMono,
  },
  {
    id: 5,
    bgColor: '#4169E1', // Royal blue
    textColor: colors.white,
    brandFont: fonts.trajan,
    titleFont: fonts.unbounded,    // ポスター用フォント
    numberFont: fonts.trajan,
  },
  {
    id: 6,
    bgColor: colors.beige,
    textColor: colors.darkGreen,
    brandFont: fonts.trajan,
    titleFont: fonts.trajan,
    numberFont: fonts.trajan,
  },
  {
    id: 7,
    bgColor: colors.darkGreen,
    textColor: colors.white,
    brandFont: fonts.trajan,
    titleFont: fonts.trajan,
    numberFont: fonts.majorMono,
  },
  {
    id: 8,
    bgColor: '#FF6347', // Tomato
    textColor: colors.black,
    brandFont: fonts.trajan,
    titleFont: fonts.poiret,       // エレガント系
    numberFont: fonts.trajan,
  },
];

// Brand names for posters (from Figma)
export const brandNames = [
  'OPEN WARDROBE MARKET',
  'OWM',
  'VERY PORTLAND',
  'form',
  'STUDIO',
  'ATELIER',
  'MAISON',
  'COLLECTION',
  'ARCHIVE',
  'VINTAGE',
  'PORTRAIT',
  'ORIGINAL',
];

// Spacing (derived from Figma layouts)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

// Border Radius
export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Shadows
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 2px 8px rgba(0, 0, 0, 0.1)',
  lg: '0 4px 16px rgba(0, 0, 0, 0.15)',
  xl: '0 8px 24px rgba(0, 0, 0, 0.2)',
} as const;

// Layout (from Figma mobile frames: 428px)
export const layout = {
  mobileWidth: 428,
  tabletWidth: 768,
  desktopWidth: 1440,
  maxWidth: 1920,

  // Grid
  mobileColumns: 2,
  tabletColumns: 4,
  desktopColumns: 8,

  gridGap: {
    mobile: 8,
    tablet: 12,
    desktop: 16,
  },
} as const;

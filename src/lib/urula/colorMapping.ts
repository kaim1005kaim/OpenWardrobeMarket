// Color name to HSL mapping utility
export const COLOR_NAME_TO_HSL: Record<string, { h: number; s: number; l: number }> = {
  'black': { h: 0, s: 0, l: 0.1 },
  'white': { h: 0, s: 0, l: 0.95 },
  'red': { h: 0, s: 0.8, l: 0.5 },
  'blue': { h: 240, s: 0.8, l: 0.5 },
  'green': { h: 120, s: 0.8, l: 0.4 },
  'yellow': { h: 60, s: 0.9, l: 0.5 },
  'orange': { h: 30, s: 0.9, l: 0.5 },
  'purple': { h: 280, s: 0.7, l: 0.5 },
  'pink': { h: 330, s: 0.7, l: 0.7 },
  'gray': { h: 0, s: 0, l: 0.5 },
  'brown': { h: 30, s: 0.5, l: 0.3 },
  'beige': { h: 40, s: 0.3, l: 0.7 },
  'navy': { h: 240, s: 0.6, l: 0.3 },
  'olive': { h: 60, s: 0.4, l: 0.3 },
  'maroon': { h: 0, s: 0.6, l: 0.3 },
  'teal': { h: 180, s: 0.6, l: 0.4 },
  'silver': { h: 0, s: 0, l: 0.75 },
  'gold': { h: 50, s: 0.8, l: 0.6 },
};

const DEFAULT_HSL = { h: 160, s: 0.25, l: 0.75 };

export interface ColorWithHSL {
  name: string;
  h: number;
  s: number;
  l: number;
}

/**
 * Convert color names to HSL objects for evolution algorithm
 */
export function convertColorNamesToHSL(colorNames: string[]): ColorWithHSL[] {
  return colorNames.map(name => {
    const normalizedName = name.toLowerCase().trim();
    const hsl = COLOR_NAME_TO_HSL[normalizedName] || DEFAULT_HSL;
    return { name, ...hsl };
  });
}

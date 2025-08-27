export const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

export const seedImg = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export const colorToCss = (c: string) => {
  switch (c) {
    case "black": return "#0a0a0a";
    case "white": return "#ffffff";
    case "navy": return "#0f1d3a";
    case "earth": return "#8b6b4f";
    case "pastel": return "#ffd1dc";
    case "neon": return "#c8ff00";
    case "monochrome": return "#c7c7c7";
    default: return c;
  }
};
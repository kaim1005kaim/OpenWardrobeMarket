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

export const randomPrice = () => {
  const prices = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000, 11000, 12000, 13000, 14000, 15000];
  return prices[Math.floor(Math.random() * prices.length)];
};
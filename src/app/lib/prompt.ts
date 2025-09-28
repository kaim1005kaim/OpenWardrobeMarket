import { GenParams } from './types';

export function safeJoin(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" | ");
}

export function personaWords(g: GenParams): string[] {
  const pickAxis = (v: number | undefined, low: string, mid: string, high: string) =>
    typeof v !== "number" ? null : v <= 33 ? low : v >= 67 ? high : mid;

  const words = [
    pickAxis(g.axisCleanBold, "clean", "balanced", "bold"),
    pickAxis(g.axisClassicFuture, "classic", "balanced", "future"),
    pickAxis(g.axisSoftSharp, "soft", "balanced", "sharp")
  ].filter(Boolean) as string[];

  const nonBalanced = words.filter((w) => w !== "balanced");
  return nonBalanced.length ? Array.from(new Set(nonBalanced)) : (words.length ? ["balanced"] : []);
}

export function buildPrompt(g: GenParams): string {
  const axesProvided = [g.axisCleanBold, g.axisClassicFuture, g.axisSoftSharp]
    .some((v) => typeof v === "number");
  const tones = axesProvided ? personaWords(g).map((w) => `tone:${w}`) : [];
  return safeJoin([
    "A full-body shot of a single model wearing",
    g.vibe && `${g.vibe} fashion`,
    ...tones,
    g.silhouette && `${g.silhouette} silhouette`,
    g.palette && `${g.palette} palette`,
    g.season && `${g.season} season`,
    g.fabric && `${g.fabric} fabric`,
    g.priceBand && `${g.priceBand} band`,
    "dramatic lighting, stylish, well-composed, fashion photography",
    g.signature,
    g.notes
  ]);
}
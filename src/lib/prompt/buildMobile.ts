export type Answers = {
  vibe: string[];
  silhouette: string[];
  color: string[];
  occasion: string[];
  season: string[];
  extra?: string;
};

export const NEGATIVE =
  "no text, no words, no logos, no brands, no celebrities, no multiple people, no watermark, no signature";

export function buildPrompt(a: Answers): string {
  const vibe = a.vibe?.[0];
  const sil = a.silhouette?.[0];
  const pal = (a.color || []).join(", ");
  const occ = a.occasion?.[0];
  const season = a.season?.[0];

  const core = [
    "single model, one person only, full-body fashion photography",
    "studio lighting, clean minimal background, high detail",
    vibe && `${vibe} vibe`,
    sil && `${sil} silhouette`,
    pal && `palette: ${pal}`,
    occ && `for ${occ}`,
    season
  ].filter(Boolean).join(", ");

  return `${core}. ${NEGATIVE}. ${a.extra || ""}`.trim();
}

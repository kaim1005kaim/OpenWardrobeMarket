export type Answers = {
  vibe: string[];
  silhouette: string[];
  color: string[];
  occasion: string[];
  season: string[];
  extra?: string;
};

export type DNA = {
  hue: number;
  sat: number;
  light: number;
  minimal_maximal: number;
  street_luxury: number;
  oversized_fitted: number;
  relaxed_tailored: number;
  texture: number;
};

export const NEGATIVE =
  "no text, no words, no logos, no brands, no celebrities, no multiple people, no watermark, no signature";

/**
 * Build base prompt from 5 question answers (existing logic)
 */
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

/**
 * Convert DNA parameters to prompt hints
 * Priority: Template > Answers > DNA > Tags
 */
export function dnaToHints(dna: DNA): string[] {
  const hints: string[] = [];

  // Minimal/Maximal axis
  if (dna.minimal_maximal < -0.3) {
    hints.push("minimalist design");
  } else if (dna.minimal_maximal > 0.3) {
    hints.push("maximalist details");
  }

  // Street/Luxury axis
  if (dna.street_luxury < -0.3) {
    hints.push("streetwear aesthetic");
  } else if (dna.street_luxury > 0.3) {
    hints.push("luxury finishes");
  }

  // Oversized/Fitted axis
  if (dna.oversized_fitted < -0.3) {
    hints.push("oversized fit");
  } else if (dna.oversized_fitted > 0.3) {
    hints.push("fitted silhouette");
  }

  // Relaxed/Tailored axis
  if (dna.relaxed_tailored < -0.3) {
    hints.push("relaxed drape");
  } else if (dna.relaxed_tailored > 0.3) {
    hints.push("sharp tailoring");
  }

  // Texture
  if (dna.texture > 0.6) {
    hints.push("visible texture");
  } else if (dna.texture < 0.3) {
    hints.push("smooth finish");
  }

  return hints;
}

/**
 * Compose full prompt with priority order:
 * Template > Answers > DNA > Tags
 */
export function composePrompt(
  answers: Answers,
  dna: DNA,
  chipsChosen: string[],
  askAnswers: Record<string, string>,
  freeTextTags: string[]
): {
  prompt: string;
  negatives: string;
  aspectRatio: string;
  quality: string;
  creativity: string;
  tags: string[];
} {
  // 1. Base from answers (highest priority after template)
  const base = buildPrompt(answers);

  // 2. DNA hints (medium priority)
  const dnaHints = dnaToHints(dna);

  // 3. Free text tags (lowest priority)
  const allTags = [...chipsChosen, ...Object.values(askAnswers), ...freeTextTags];

  // Build final prompt
  const parts = [
    base,
    dnaHints.length > 0 ? dnaHints.join(", ") : "",
    allTags.length > 0 ? allTags.join(", ") : ""
  ].filter(Boolean);

  const prompt = parts.join(". ").trim();

  return {
    prompt,
    negatives: NEGATIVE,
    aspectRatio: "3:4",
    quality: "high",
    creativity: "balanced",
    tags: allTags
  };
}

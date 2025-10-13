export const PRESETS = [
  { id: "street_black",  label: "ストリート黒",   vibe: "street",  palette: "black",      silhouette: "oversized", season: "aw" },
  { id: "soft_minimal",  label: "ソフトミニマル", vibe: "minimal", palette: "monochrome", silhouette: "relaxed",   season: "ss" },
  { id: "outdoor_earth", label: "アウトドア土色", vibe: "outdoor", palette: "earth",      silhouette: "straight",  season: "ss" },
  { id: "tech_neon",     label: "テック×ネオン",  vibe: "techwear",palette: "neon",       silhouette: "tailored",  season: "aw" },
  { id: "retro_navy",    label: "レトロネイビー", vibe: "retro",   palette: "navy",       silhouette: "cropped",   season: "pre-fall" },
] as const;

export const SIGNATURES = [
  "contrast stitching",
  "asymmetric lines",
  "oversized pocket",
  "hidden placket",
  "panel blocking",
  "raw edge",
] as const;
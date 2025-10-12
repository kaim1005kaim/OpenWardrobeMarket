// 設問の回答に応じて形状と色を決定するロジック

export type MorphConfig = {
  morphType: number; // 0-4
  colorA: string;
  colorB: string;
};

// 各vibeに対応する形状と色
const vibeConfigs: Record<string, MorphConfig> = {
  minimal: {
    morphType: 0, // 同心円
    colorA: "#F4DDD4",
    colorB: "#D4887A",
  },
  street: {
    morphType: 1, // 歪んだ四角形
    colorA: "#D4E5F4",
    colorB: "#7A9FD4",
  },
  luxury: {
    morphType: 2, // オーガニック形状
    colorA: "#E5D4F4",
    colorB: "#9A7AD4",
  },
  outdoor: {
    morphType: 3, // 縦ストライプ
    colorA: "#D4F4DD",
    colorB: "#7AD48F",
  },
  workwear: {
    morphType: 4, // モアレ
    colorA: "#333333",
    colorB: "#666666",
  },
  athleisure: {
    morphType: 1, // 歪んだ四角形
    colorA: "#F4E5D4",
    colorB: "#D4A87A",
  },
};

// シルエットに応じて色の調整
const silhouetteColorShift: Record<string, { hueShift: number; satShift: number }> = {
  oversized: { hueShift: 10, satShift: 0.1 },
  fitted: { hueShift: -10, satShift: 0.15 },
  loose: { hueShift: 5, satShift: -0.05 },
  tailored: { hueShift: -15, satShift: 0.2 },
  relaxed: { hueShift: 0, satShift: -0.1 },
};

// カラーパレットに応じた色の調整
const colorPaletteMap: Record<string, { colorA: string; colorB: string }> = {
  black: { colorA: "#1a1a1a", colorB: "#4a4a4a" },
  white: { colorA: "#f5f5f5", colorB: "#d0d0d0" },
  navy: { colorA: "#1a2a4a", colorB: "#4a5a7a" },
  earth: { colorA: "#8b7355", colorB: "#d4b896" },
  pastel: { colorA: "#ffd4e5", colorB: "#d4e5ff" },
  neon: { colorA: "#ff00ff", colorB: "#00ffff" },
  monochrome: { colorA: "#2a2a2a", colorB: "#e5e5e5" },
};

export function getMorphConfig(answers: Record<string, string[]>): MorphConfig {
  const vibe = answers.vibe?.[0];
  const silhouette = answers.silhouette?.[0];
  const colors = answers.color || [];

  // vibeから基本形状と色を取得
  let config: MorphConfig = vibeConfigs[vibe || "minimal"] || vibeConfigs.minimal;

  // カラーパレットが選択されている場合は色を優先
  if (colors.length > 0) {
    const primaryColor = colors[0];
    if (colorPaletteMap[primaryColor]) {
      config = {
        ...config,
        ...colorPaletteMap[primaryColor],
      };
    }
  }

  // シルエットに応じて微調整（今後実装可能）
  // if (silhouette && silhouetteColorShift[silhouette]) {
  //   // HSL変換して色相をシフト
  // }

  return config;
}

// ステップごとの形状変化（オプション）
export function getMorphTypeForStep(step: number, answers: Record<string, string[]>): number {
  // ステップに応じて段階的に形状を変化させる
  const config = getMorphConfig(answers);
  return config.morphType;
}

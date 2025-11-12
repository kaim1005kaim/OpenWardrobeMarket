/**
 * シルエット・モデル多様性コンフィグ
 * FUSION/COMPOSER 共通設定
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1) シルエット母集団（12–16種）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const SILHOUETTES = [
  "tailored",
  "A-line",
  "boxy",
  "column",
  "mermaid",
  "parachute",
  "cocoon",
  "oversized",
  "wrap",
  "bias-cut",
  "drop-waist",
  "kimono-inspired",     // 抽象的：直線裁ち/帯状要素
  "trench/utility",      // パネル/ベルト/ストームフラップ
  "parka/volume-shell",  // テクニカル・ボリューム
  "sheath"               // 細身ストレート
] as const;

export type Silhouette = typeof SILHOUETTES[number];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2) 人物多様性（確率表）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * アジア合計 70%（JP/KR、男女、20s/30s を均等8分割：各 8.75%）
 * 残り 30%（白人/黒人、男女、20s-30s 統合：各 7.5%）
 */
export const MODEL_WEIGHTS = {
  // アジア 70%
  asia: {
    jp_f_20s: 0.0875,
    jp_f_30s: 0.0875,
    kr_f_20s: 0.0875,
    kr_f_30s: 0.0875,
    jp_m_20s: 0.0875,
    jp_m_30s: 0.0875,
    kr_m_20s: 0.0875,
    kr_m_30s: 0.0875,
  },
  // その他 30%
  other: {
    white_f_20s_30s: 0.075,
    white_m_20s_30s: 0.075,
    black_f_20s_30s: 0.075,
    black_m_20s_30s: 0.075,
  }
} as const;

export type DemographicKey =
  | keyof typeof MODEL_WEIGHTS.asia
  | keyof typeof MODEL_WEIGHTS.other;

/**
 * 人物なし（プロダクトフォワード）の確率
 * 0.00 = 常に人物あり（推奨）
 * 0.15 = 15%の確率で人物なし
 */
export const NO_MODEL_PROBABILITY = 0.00;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3) 冷却パラメータ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const COOLDOWN_CONFIG = {
  /** 直近何件を見るか */
  window: 5,
  /** 重複ペナルティ係数 (0.35^r) */
  factor: 0.35,
} as const;

export const SAMPLING_CONFIG = {
  /** Top-k サンプリング（希少枠も残す） */
  topK: 4,
  /** 温度パラメータ（0.85 推奨） */
  temperature: 0.85,
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4) 背景・照明の多様性
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BACKGROUND_CONFIG = {
  /** 背景色の確率（70% カラー、30% 白） */
  colorProbability: 0.70,
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5) ヘルパー関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 全モデルウェイトをフラット化して返す
 */
export function getAllModelWeights(): Record<DemographicKey, number> {
  return {
    ...MODEL_WEIGHTS.asia,
    ...MODEL_WEIGHTS.other,
  };
}

/**
 * 人口統計キーから中立的な記述子を生成
 *
 * 安全・中立語彙を使用：
 * - "model of Japanese descent, 20s" / "Korean male model in his 30s"
 * - 髪・メイクは撮影仕様："studio hair styling, clean natural makeup"
 * - 体型・露出の強調は禁止
 * - 著名人・特定個人の暗示、文化のステレオタイプ表現は禁止
 */
export function demographicPhrase(key: DemographicKey): string {
  const phraseMap: Record<DemographicKey, string> = {
    // 日本人女性
    jp_f_20s: "female model of Japanese descent in her 20s, studio hair styling, clean natural makeup",
    jp_f_30s: "female model of Japanese descent in her 30s, studio hair styling, clean natural makeup",

    // 韓国人女性
    kr_f_20s: "female model of Korean descent in her 20s, studio hair styling, clean natural makeup",
    kr_f_30s: "female model of Korean descent in her 30s, studio hair styling, clean natural makeup",

    // 日本人男性
    jp_m_20s: "male model of Japanese descent in his 20s, studio grooming",
    jp_m_30s: "male model of Japanese descent in his 30s, studio grooming",

    // 韓国人男性
    kr_m_20s: "male model of Korean descent in his 20s, studio grooming",
    kr_m_30s: "male model of Korean descent in his 30s, studio grooming",

    // 白人
    white_f_20s_30s: "female model of European descent, 20s-30s, studio hair styling, clean natural makeup",
    white_m_20s_30s: "male model of European descent, 20s-30s, studio grooming",

    // 黒人
    black_f_20s_30s: "female model of African descent, 20s-30s, studio hair styling, clean natural makeup",
    black_m_20s_30s: "male model of African descent, 20s-30s, studio grooming",
  };

  return phraseMap[key];
}

/**
 * シルエットの抽象的説明（文化要素は形状語彙として）
 */
export function silhouetteDescription(silhouette: Silhouette): string {
  const descMap: Record<Silhouette, string> = {
    "tailored": "structured, fitted through shoulders and waist, clean lines",
    "A-line": "fitted at top, gradually widening toward hem, triangular silhouette",
    "boxy": "straight, relaxed fit with minimal waist definition",
    "column": "straight vertical lines from shoulder to hem, narrow silhouette",
    "mermaid": "fitted through body, dramatic flare from knee or mid-thigh",
    "parachute": "voluminous with gathered or elasticated details, cocoon-like",
    "cocoon": "rounded, enveloping shape with soft volume",
    "oversized": "deliberately large proportions, relaxed fit throughout",
    "wrap": "crossed front closure, often with tie or belt detail",
    "bias-cut": "diagonal grain, fluid drape, body-skimming",
    "drop-waist": "lowered waistline, often at hip level",
    "kimono-inspired": "straight-cut panels, minimal shaping, band-like elements, abstract geometric construction",
    "trench/utility": "structured panels, belt details, storm flap elements, functional design",
    "parka/volume-shell": "technical volume, protective silhouette, architectural shell",
    "sheath": "slim, straight fit close to body, minimal ease"
  };

  return descMap[silhouette];
}

/**
 * シルエットのベースウェイト（初期値は均等）
 */
export function getBaseSilhouetteWeights(): Map<Silhouette, number> {
  const baseWeight = 1.0 / SILHOUETTES.length;
  return new Map(SILHOUETTES.map(s => [s, baseWeight]));
}

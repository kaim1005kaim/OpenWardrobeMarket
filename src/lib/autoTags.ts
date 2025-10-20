import type { Answers, DNA } from '../types/dna';

/**
 * 画像生成パラメータから自動タグを生成
 * ユーザー検索と類似画像表示の精度向上のため
 */
export function generateAutoTags(params: {
  answers: Answers;
  dna: DNA;
  prompt?: string;
}): string[] {
  const tags: string[] = [];
  const { answers, dna, prompt } = params;

  // === Vibe ===
  if (answers.vibe) {
    answers.vibe.forEach((v) => {
      const normalized = v.toLowerCase();
      if (normalized.includes('minimal')) {
        tags.push('minimalist', 'clean', 'simple');
      }
      if (normalized.includes('streetwear') || normalized.includes('street')) {
        tags.push('urban', 'streetwear', 'casual');
      }
      if (normalized.includes('formal') || normalized.includes('elegant')) {
        tags.push('formal', 'elegant', 'sophisticated');
      }
      if (normalized.includes('vintage') || normalized.includes('retro')) {
        tags.push('vintage', 'retro', 'classic');
      }
      if (normalized.includes('sporty') || normalized.includes('athletic')) {
        tags.push('sporty', 'athletic', 'active');
      }
      if (normalized.includes('avant')) {
        tags.push('avant-garde', 'experimental', 'bold');
      }
      if (normalized.includes('romantic') || normalized.includes('feminine')) {
        tags.push('romantic', 'feminine', 'soft');
      }
    });
  }

  // === Silhouette ===
  if (answers.silhouette) {
    answers.silhouette.forEach((s) => {
      const normalized = s.toLowerCase();
      if (normalized.includes('oversized') || normalized.includes('loose')) {
        tags.push('oversized', 'relaxed', 'loose-fit');
      }
      if (normalized.includes('fitted') || normalized.includes('slim')) {
        tags.push('fitted', 'slim', 'tailored');
      }
      if (normalized.includes('structured')) {
        tags.push('structured', 'architectural');
      }
      if (normalized.includes('flowing') || normalized.includes('draped')) {
        tags.push('flowing', 'draped', 'fluid');
      }
    });
  }

  // === Color ===
  if (answers.color) {
    answers.color.forEach((c) => {
      const normalized = c.toLowerCase();
      if (normalized.includes('neutral') || normalized.includes('monochrome')) {
        tags.push('neutral', 'monochrome', 'minimal-palette');
      }
      if (normalized.includes('vibrant') || normalized.includes('bold')) {
        tags.push('vibrant', 'bold-colors', 'colorful');
      }
      if (normalized.includes('pastel')) {
        tags.push('pastel', 'soft-colors');
      }
      if (normalized.includes('earth') || normalized.includes('natural')) {
        tags.push('earth-tones', 'natural', 'organic');
      }
      if (normalized.includes('black')) {
        tags.push('black', 'dark', 'gothic');
      }
      if (normalized.includes('white')) {
        tags.push('white', 'pure', 'clean');
      }
    });
  }

  // === Occasion ===
  if (answers.occasion) {
    answers.occasion.forEach((o) => {
      const normalized = o.toLowerCase();
      if (normalized.includes('casual') || normalized.includes('everyday')) {
        tags.push('casual', 'everyday', 'lifestyle');
      }
      if (normalized.includes('work') || normalized.includes('office')) {
        tags.push('workwear', 'professional', 'office');
      }
      if (normalized.includes('party') || normalized.includes('evening')) {
        tags.push('party', 'evening', 'night-out');
      }
      if (normalized.includes('outdoor') || normalized.includes('adventure')) {
        tags.push('outdoor', 'adventure', 'functional');
      }
      if (normalized.includes('formal') || normalized.includes('ceremony')) {
        tags.push('formal', 'ceremonial', 'special-occasion');
      }
    });
  }

  // === Season ===
  if (answers.season) {
    answers.season.forEach((s) => {
      const normalized = s.toLowerCase();
      if (normalized.includes('spring')) {
        tags.push('spring', 'light-layers');
      }
      if (normalized.includes('summer')) {
        tags.push('summer', 'lightweight', 'breathable');
      }
      if (normalized.includes('fall') || normalized.includes('autumn')) {
        tags.push('fall', 'autumn', 'layering');
      }
      if (normalized.includes('winter')) {
        tags.push('winter', 'cold-weather', 'cozy');
      }
    });
  }

  // === DNA (minimal_maximal axis) ===
  if (dna.minimal_maximal !== undefined) {
    if (dna.minimal_maximal > 0.5) {
      // Maximal side: bold, experimental
      tags.push('bold', 'experimental', 'maximalist', 'statement');
    } else if (dna.minimal_maximal < -0.5) {
      // Minimal side: clean, refined
      tags.push('minimal', 'clean', 'refined', 'simple');
    } else {
      // Balanced
      tags.push('balanced', 'contemporary', 'modern');
    }
  }

  // === Prompt keywords ===
  if (prompt) {
    const promptLower = prompt.toLowerCase();
    // Extract common fashion keywords
    const keywords = [
      'jacket', 'coat', 'dress', 'shirt', 'pants', 'skirt', 'sweater',
      'denim', 'leather', 'wool', 'cotton', 'silk',
      'layered', 'pattern', 'texture', 'print',
      'asymmetric', 'cutout', 'ruffle', 'pleated'
    ];

    keywords.forEach((keyword) => {
      if (promptLower.includes(keyword)) {
        tags.push(keyword);
      }
    });
  }

  // 重複削除と返却
  return [...new Set(tags)];
}

/**
 * タグの重要度スコアを計算（将来の検索ランキング用）
 */
export function calculateTagRelevance(
  imageTags: string[],
  searchTags: string[]
): number {
  const matches = imageTags.filter((tag) =>
    searchTags.some((searchTag) =>
      tag.includes(searchTag) || searchTag.includes(tag)
    )
  );

  return matches.length / Math.max(searchTags.length, 1);
}

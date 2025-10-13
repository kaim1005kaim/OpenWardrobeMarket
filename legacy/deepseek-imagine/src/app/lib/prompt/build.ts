// プロンプト構築のメインロジック
import { ChatSelections, LlmPromptResult, GeneratePayload } from './types';
import { composeWithDeepSeek } from './deepseek';

function joinSafe(parts: Array<string | undefined | null>): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(', ');
}

function mapCreativityToMj(creativity: LlmPromptResult['creativity']): string {
  // stylize / variation の目安
  switch (creativity) {
    case 'conservative': 
      return '--style raw --s 50 --q 1';
    case 'balanced': 
      return '--style raw --s 100 --q 1';
    case 'experimental': 
      return '--style raw --s 200 --q 1.5';
    case 'maximum': 
      return '--style raw --s 300 --q 2';
    default:
      return '--style raw --s 100 --q 1';
  }
}

function mapAspectRatio(ratio: string): string {
  // ImagineAPIで使う形式に変換
  switch (ratio) {
    case '3:4': return '3:4';
    case '1:1': return '1:1';
    case '2:3': return '2:3';
    case '9:16': return '9:16';
    case '16:9': return '16:9';
    default: return '3:4';
  }
}

export async function buildGeneratePayload(sel: ChatSelections): Promise<GeneratePayload> {
  // DeepSeekでプロンプト生成
  const llm: LlmPromptResult = await composeWithDeepSeek(sel);

  // コアプロンプトの構築
  const coreParts = [
    'single model',
    'one person only',
    'full body composition',
    'fashion lookbook style',
    'professional fashion photography',
    'clean minimal background',
    'studio lighting',
    'high resolution'
  ];

  // LLMが生成したプロンプトを追加
  if (llm.prompt && !llm.prompt.includes('single model')) {
    coreParts.push(llm.prompt);
  }

  const core = joinSafe(coreParts);
  
  // ネガティブプロンプトの重複を除去
  const negative = Array.from(new Set(llm.negatives)).join(', ');

  // Midjourney互換パラメータの構築
  const mjParts = [
    `--ar ${mapAspectRatio(llm.aspectRatio)}`,
    mapCreativityToMj(llm.creativity)
  ];
  
  // 品質設定を追加
  if (llm.quality === 'ultra') {
    mjParts.push('--quality 2');
  }

  const mj = mjParts.join(' ');

  return {
    prompt: core,
    negative_prompt: negative,
    params: {
      aspectRatio: llm.aspectRatio,
      quality: llm.quality,
      creativity: llm.creativity,
      mj
    }
  };
}

// シンプルなビルド（DeepSeekを使わない高速版）
export function buildSimplePrompt(
  vibe?: string,
  silhouette?: string,
  palette?: string
): string {
  const parts = [
    'single model',
    'full-body fashion photography', 
    'professional studio lighting',
    'clean minimal background'
  ];

  if (vibe) parts.push(`${vibe} style`);
  if (silhouette) parts.push(`${silhouette} fit`);
  if (palette) parts.push(`${palette} colors`);

  return joinSafe(parts);
}
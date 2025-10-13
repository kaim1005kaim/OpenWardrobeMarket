// プロンプト生成システムの型定義
export type Creativity = 'conservative' | 'balanced' | 'experimental' | 'maximum';
export type Quality = 'standard' | 'high' | 'ultra';
export type CameraAngle = 'full-body' | 'portrait' | 'random';
export type AspectRatio = '3:4' | '1:1' | '2:3' | '9:16' | '16:9';

export interface ChatSelections {
  vibe?: string;              // 'minimal'|'streetwear'|'retro'...
  silhouette?: string;        // 'tailored'|'oversized'|'cropped'...
  palette?: string;           // 'monochrome'|'pastel'|'earth-tone'...
  mood?: string;              // 'casual'|'formal'|'night-out'...
  signature?: string[];       // ["quiet luxury", ...]
  freeText?: string;          // 任意の追加テキスト
  customRequest?: string;     // カスタムプロンプト
  aspectRatio?: AspectRatio;
  quality?: Quality;
  creativity?: Creativity;
  // 参考画像解析結果（任意）
  refAnalysis?: {
    style?: string[];
    shape?: string[];
    palette?: string[];
  };
}

export interface LlmPromptResult {
  prompt: string;
  negatives: string[];
  quality: Quality;
  cameraAngle: CameraAngle;
  aspectRatio: AspectRatio;
  creativity: Creativity;
  styleTags: string[];
  colorTags: string[];
  notes?: string;
}

// MJ/ImagineAPIに渡す最終形
export interface GeneratePayload {
  prompt: string;
  negative_prompt: string;
  params: {
    aspectRatio: AspectRatio;
    quality: Quality;
    creativity: Creativity;
    // Midjourney互換パラメータ
    mj: string; // "--ar 3:4 --style raw --s 100 --q 1" など
  };
}
# 類似画像検索システムの設計

## 目標
- ユーザーが求める画像を見つけやすくする
- 詳細ページで関連画像を表示
- 検索機能の精度向上

## Pinterestの仕組み

### 1. 画像埋め込み（Image Embeddings）
- ResNet、EfficientNet、CLIP等のCNNで画像を512〜2048次元のベクトルに変換
- 似た画像は近いベクトルになる
- 例: `[0.5, -0.3, 0.8, ...]` (512次元)

### 2. ベクトル検索
- コサイン類似度: `similarity = dot(a, b) / (||a|| * ||b||)`
- ベクトルDBで高速検索: FAISS, Pinecone, Milvus

### 3. メタデータ
- ユーザータグ
- 自動生成タグ（画像認識AI）
- 行動データ（クリック、いいね）

## 実装プラン

### フェーズ1: 自動タグ生成（即座に実装可能）

**生成時に自動タグを埋め込む**

```typescript
// 生成完了時
const autoTags = generateAutoTags({
  answers: { vibe, silhouette, color, occasion, season },
  dna: { chaos, palette },
  prompt: userPrompt
});

// 例: ['casual', 'oversized', 'neutral', 'streetwear', 'minimalist']
```

**利点:**
- 実装が簡単
- 既存システムに統合しやすい
- 即座に動作

**欠点:**
- ルールベースなので精度に限界

### フェーズ2: Gemini Vision APIで画像タグ生成

**Gemini Vision APIを使用**

```typescript
const response = await gemini.generateContent({
  model: 'gemini-1.5-flash',
  contents: [{
    parts: [
      { text: 'この画像をファッションタグで説明してください（5-10個）' },
      { inlineData: { mimeType: 'image/png', data: imageBase64 } }
    ]
  }]
});

// 応答例: "oversized, streetwear, neutral tones, minimalist, urban, casual"
```

**利点:**
- 高精度
- 視覚的特徴を捉える
- Google Cloud Visionより安価

**欠点:**
- API呼び出しのコスト

### フェーズ3: ベクトル埋め込み検索（長期）

**Supabase + pgvectorで実装**

```sql
-- ベクトル拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- embeddings列を追加
ALTER TABLE images ADD COLUMN embedding vector(512);

-- 類似度検索
SELECT id, title, 1 - (embedding <=> '[0.5,-0.3,...]'::vector) AS similarity
FROM images
WHERE 1 - (embedding <=> '[0.5,-0.3,...]'::vector) > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

**埋め込み生成:**
- OpenAI CLIP API
- または Hugging Face Transformers

**利点:**
- 最高精度
- タグなしでも動作

**欠点:**
- 実装コスト高
- 埋め込み生成に時間

## 推奨実装順序

### 今すぐ: フェーズ1（自動タグ）
```typescript
// src/lib/autoTags.ts
export function generateAutoTags(params: {
  answers: Answers;
  dna: DNA;
  prompt?: string;
}): string[] {
  const tags: string[] = [];

  // Vibeからタグ
  if (params.answers.vibe?.includes('minimal')) tags.push('minimalist', 'clean');
  if (params.answers.vibe?.includes('streetwear')) tags.push('urban', 'streetwear');

  // Silhouetteからタグ
  if (params.answers.silhouette?.includes('oversized')) tags.push('oversized', 'relaxed');

  // Colorからタグ
  if (params.answers.color?.includes('neutral')) tags.push('neutral', 'monochrome');

  // Chaosからタグ
  if (params.dna.chaos > 0.7) tags.push('bold', 'avant-garde');
  else if (params.dna.chaos < 0.3) tags.push('classic', 'timeless');

  return [...new Set(tags)]; // 重複除去
}
```

### 1-2週間後: フェーズ2（Gemini Vision）
- 既存のGemini統合を拡張
- 生成完了時に画像解析してタグ生成

### 長期: フェーズ3（ベクトル検索）
- Supabase pgvectorセットアップ
- OpenAI CLIP API統合
- 全画像の埋め込み生成バッチ処理

## データベーススキーマ

```sql
-- 自動タグ用
ALTER TABLE images ADD COLUMN auto_tags TEXT[];
CREATE INDEX idx_images_auto_tags ON images USING GIN(auto_tags);

-- ベクトル検索用（将来）
ALTER TABLE images ADD COLUMN embedding vector(512);
CREATE INDEX idx_images_embedding ON images USING ivfflat(embedding vector_cosine_ops);
```

## 検索クエリ例

```typescript
// タグベース検索
const { data } = await supabase
  .from('images')
  .select('*')
  .contains('auto_tags', ['streetwear', 'oversized'])
  .limit(20);

// ベクトル検索（将来）
const { data } = await supabase.rpc('match_images', {
  query_embedding: queryVector,
  match_threshold: 0.7,
  match_count: 10
});
```

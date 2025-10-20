# フェーズ2: Gemini Vision API実装完了

## 📋 実装概要

類似画像検索システムのフェーズ2として、Gemini Vision APIを使用した画像解析と自動タグ生成機能を実装しました。

## ✅ 実装内容

### 1. Gemini Vision API画像解析エンドポイント

**ファイル**: `app/api/gemini/analyze-image/route.ts`

- **機能**: 生成された画像を解析してファッションタグを自動生成
- **モデル**: `gemini-1.5-flash` (コスト効率が良い)
- **出力**: 5-10個の英語タグ + 1文の説明文

**タグの種類**:
- シルエット: oversized, fitted, relaxed, tailored
- スタイル: minimal, streetwear, luxury, avant-garde
- 色: neutral, monochrome, bold, pastel
- 質感: smooth, textured, matte, glossy
- デザイン要素: layered, asymmetric, geometric

**禁止ワード**:
- ブランド名、ロゴ、著名人、透かし
- 一般的すぎる単語 (clothing, fashion, design)

### 2. 生成時の自動タグ生成統合

**ファイル**: `src/app/pages/mobile/MobileCreatePage.tsx`

**処理フロー**:
```
1. 画像生成完了
2. R2にアップロード
3. ルールベースタグ生成（既存のgenerateAutoTags）
4. Gemini Vision APIで画像解析 ⬅ NEW
5. ルールタグ + AIタグをマージ（重複除去）
6. PublishFormページに遷移
```

**タグの組み合わせ**:
- **ルールベース**: vibe, silhouette, color, chaos levelから生成
- **AIベース**: Gemini Visionが画像から視覚的特徴を抽出
- **最終タグ**: 両方をマージして重複を削除

### 3. データベーススキーマ拡張

**ファイル**: `migrations/add_auto_tags_to_published_items.sql`

```sql
-- 新しい列
ALTER TABLE published_items ADD COLUMN auto_tags TEXT[];
ALTER TABLE published_items ADD COLUMN ai_description TEXT;

-- インデックス（高速検索用）
CREATE INDEX idx_published_items_auto_tags ON published_items USING GIN(auto_tags);
CREATE INDEX idx_published_items_ai_description_trgm ON published_items USING GIN(ai_description gin_trgm_ops);
```

**注意**: マイグレーションファイルは作成済みですが、ネットワークエラーにより実行できていません。
Supabaseダッシュボードから手動で実行してください。

### 4. 類似画像検索API

**ファイル**: `app/api/similar-items/route.ts`

**アルゴリズム**: Jaccard類似度
```
similarity = |A ∩ B| / |A ∪ B|
```

**処理フロー**:
1. 対象アイテムの`auto_tags`を取得
2. PostgreSQLの配列重複演算子 (`&&`) で候補を検索
3. Jaccard類似度でランキング
4. 同じカテゴリにボーナス (+0.1)
5. 上位N件を返却

**フォールバック**:
- `auto_tags`が空の場合 → 同じカテゴリからランダム表示

### 5. 詳細ページへの統合

**ファイル**: `src/app/components/mobile/MobileDetailModal.tsx`

**機能**:
- モーダル表示時に自動的に類似アイテムをAPI経由で取得
- AI生成の類似アイテムを優先表示
- フォールバック: 手動で渡された`similarAssets`
- ローディングスピナー表示

## 🎯 使用例

### 画像解析APIの呼び出し

```typescript
const response = await fetch(`${apiUrl}/api/gemini/analyze-image`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    imageData: base64Image, // "data:image/png;base64,..." or just base64
    mimeType: 'image/png',
  }),
});

const { tags, description } = await response.json();
// tags: ['oversized', 'streetwear', 'neutral-tones', 'relaxed', 'urban']
// description: "A minimalist streetwear design with oversized silhouette and neutral color palette."
```

### 類似画像検索APIの呼び出し

```typescript
const response = await fetch(`${apiUrl}/api/similar-items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemId: 'uuid-of-target-item',
    limit: 10,
  }),
});

const { similar_items, algorithm } = await response.json();
// similar_items: [{ id, title, image_id, auto_tags, similarity_score, overlapping_tags }, ...]
// algorithm: "auto_tags_jaccard" or "category_fallback"
```

## 📊 期待される効果

### 1. 検索精度の向上
- **従来**: ユーザーが手動で入力したタグのみ
- **現在**: ルールベース + AI視覚解析 = より豊富で正確なタグ

### 2. 類似画像レコメンド
- Pinterest風の「似たデザイン」セクション
- Jaccard類似度で関連性の高いアイテムを表示
- ユーザーのブラウジング時間増加

### 3. ディスカバビリティ
- タグが多いほど検索でヒットしやすい
- ビジュアル特徴ベースの検索が可能

## 🚀 次のステップ（フェーズ3: ベクトル埋め込み）

フェーズ2で実装したタグベース検索は高速で実用的ですが、さらに精度を上げるには:

### 長期目標
1. **Supabase pgvector拡張を有効化**
   ```sql
   CREATE EXTENSION vector;
   ALTER TABLE published_items ADD COLUMN embedding vector(512);
   ```

2. **OpenAI CLIP APIまたはHugging Face Transformers**
   - 画像を512次元ベクトルに変換
   - コサイン類似度で検索

3. **ハイブリッド検索**
   - タグベース検索（速い、説明可能）
   - ベクトル検索（精度高い）
   - 両方のスコアを組み合わせて最終ランキング

## 📝 注意事項

### マイグレーション実行が必要
`migrations/add_auto_tags_to_published_items.sql` をSupabaseで手動実行してください:

1. Supabaseダッシュボードにログイン
2. SQL Editorを開く
3. マイグレーションファイルの内容をコピー＆実行

### 環境変数の確認
`.env.local` に以下が設定されていることを確認:
```
GOOGLE_API_KEY=your_google_api_key_for_gemini
```

### コスト管理
- Gemini 1.5 Flashは安価ですが、大量の画像生成時はコストに注意
- 必要に応じてキャッシュ機構を追加検討

## 🎉 完成

フェーズ2の実装は完了しました。Gemini Vision APIを使用した高度な画像解析と、タグベースの類似画像検索システムが稼働します。

次はフェーズ3のベクトル埋め込み検索を検討してください（長期プロジェクト）。

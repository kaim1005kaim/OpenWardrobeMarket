# FUSION バリアント生成システム - 実装ドキュメント

最終更新: 2025-11-25

## 概要

FUSIONモードで生成したメイン画像（正面）から、同じ衣服のサイド（SIDE）とバック（BACK）の画像を自動生成するシステム。

## システムアーキテクチャ

### 3つのAPI エンドポイント

1. **`/api/fusion/start-variants`** - ジョブ作成（即座にレスポンス）
2. **`/api/fusion/variants-generate`** - 単一バリアント生成（タイムアウト回避）
3. **`/api/fusion/variants-stream`** - SSEストリーム（進捗通知のみ）

### データベーススキーマ

#### `generation_history` テーブル（新規追加カラム）

```sql
-- メイン画像の再現性を保証するシード値
seed_main INTEGER

-- 抽出された衣服のデザイン情報（色、素材、ディテール）
design_tokens JSONB

-- モデルの人口統計情報（例: "jp_f_20s", "unisex"）
demographic TEXT

-- バリアント生成状況の配列
variants JSONB DEFAULT '[]'::jsonb
-- 構造: [
--   {
--     type: "side" | "back",
--     r2_url: string,
--     status: "pending" | "generating" | "completed" | "failed",
--     tries: number
--   }
-- ]

-- 生成モード識別子
mode TEXT
```

#### `variants_jobs` テーブル（新規作成）

```sql
CREATE TABLE variants_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gen_id UUID NOT NULL REFERENCES generation_history(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('side', 'back')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- メイン画像情報
  base_prompt TEXT,
  base_r2_key TEXT,
  base_seed INTEGER,
  base_dna JSONB,
  demographic TEXT,
  design_tokens JSONB,

  -- 生成結果
  r2_key TEXT,
  r2_url TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## API 実装詳細

### 1. `/api/fusion/start-variants` (POST)

**役割**: バリアント生成ジョブの登録（高速レスポンス）

**リクエスト**:
```json
{
  "genId": "uuid",
  "userId": "uuid",
  "views": ["side", "back"]
}
```

**処理フロー**:
1. `generation_history`から元データ取得（prompt, seed, demographic, design_tokens）
2. SIDEとBACKのジョブを`variants_jobs`に作成（status: "pending"）
3. 即座にレスポンス返却（生成は行わない）

**レスポンス**:
```json
{
  "success": true,
  "genId": "uuid",
  "jobs": [
    { "id": "job_uuid_1", "type": "side", "status": "pending" },
    { "id": "job_uuid_2", "type": "back", "status": "pending" }
  ]
}
```

**maxDuration**: 10秒（ジョブ登録のみ）

---

### 2. `/api/fusion/variants-generate` (POST)

**役割**: 単一バリアントの生成実行（1ジョブずつ処理）

**リクエスト**:
```json
{
  "job_id": "job_uuid_1"
}
```

**処理フロー**:

1. **ジョブ取得**
   - `variants_jobs`から該当ジョブを取得
   - status: "pending" を確認

2. **デザイントークン取得**
   - ジョブ内に`design_tokens`があればそれを使用
   - なければ`generation_history`から取得
   - **重要**: `demographic`は必ず`generation_history`から取得（ユーザーの選択を尊重）

3. **プロンプト生成**
   - `buildFusionVariantPrompt()`でビュー専用プロンプト構築
   - SIDE: 90度横向き、顔不可視、側面縫製・袖構造を強調
   - BACK: 180度後ろ向き、完全背面、バック縫製・シルエット強調
   - 色・素材・ディテールはメイン画像と完全一致を指示

4. **画像生成**
   - Imagen 3.0 で生成
   - シード値: `base_seed + offset` (SIDE=+1, BACK=+2) で再現性確保
   - guidanceScale: 40（強い一貫性）
   - aspectRatio: "3:4"

5. **結果保存**
   - R2にアップロード: `generations/fusion-variants/{genId}/{view}_{timestamp}.jpg`
   - `variants_jobs`を status: "completed" に更新
   - `generation_history.variants`配列に結果追加

6. **SSE 通知**
   - `emitVariantProgress()`で進捗をストリーム送信

**レスポンス**:
```json
{
  "success": true,
  "job_id": "job_uuid_1",
  "view": "side",
  "url": "https://assets.open-wardrobe-market.com/generations/fusion-variants/...",
  "variant": {
    "type": "side",
    "r2_url": "...",
    "status": "completed",
    "tries": 1
  }
}
```

**maxDuration**: 120秒（1生成分）

**エラーハンドリング**:
- エラー時は`variants_jobs.status`を"failed"に更新
- `error_message`にエラー内容を記録
- ジョブテーブルで失敗履歴を保持

---

### 3. `/api/fusion/variants-stream` (GET)

**役割**: バリアント生成進捗のSSE通知（ポーリング型）

**リクエスト**: `GET /api/fusion/variants-stream?genId={uuid}`

**処理フロー**:
1. SSEストリーム開始
2. 5秒間隔で`generation_history.variants`をポーリング
3. 状態変化があればクライアントに通知
4. 全ジョブ完了時に`all_complete`イベント送信
5. 90秒後に自動クローズ（タイムアウト回避）

**SSE イベント**:

```
data: {"type":"connected","genId":"uuid"}

data: {"type":"variants_update","variants":[...]}

data: {"type":"variant_complete","view":"side","variant":{...}}

data: {"type":"all_complete","variants":[...]}

data: {"type":"timeout","message":"Stream auto-closed after 90s"}
```

**重要な修正点**:
- `all_complete`は全**期待ジョブ数**が完了してから送信
- `currentVariants.length >= expectedJobCount`をチェック
- ジョブ数は`variants_jobs`テーブルから取得

**maxDuration**: 120秒

---

## プロンプト設計

### `buildFusionVariantPrompt()`

**入力**:
- `tokens: DesignTokens` - 抽出済みデザイン情報
- `basePrompt: string` - 元のプロンプト
- `view: 'side' | 'back'` - 生成ビュー
- `demographic: string` - モデル属性

**DesignTokens 構造**:
```typescript
interface DesignTokens {
  garment_type: string;       // "パーカー", "Tシャツ" など
  silhouette: string;         // "オーバーサイズ", "スリムフィット"
  length: string;             // "ヒップ丈", "ウエスト丈"
  neckline: string;           // "フード付き", "クルーネック"
  sleeve: string;             // "長袖", "半袖"
  materials: string[];        // ["コットン", "ポリエステル"]
  palette_hex: string[];      // ["#FF5733", "#C70039"]
  invariant_details: string[]; // ["フロントポケット", "ドローコード"]
  trim: string[];             // ["リブ編み裾", "ジッパー"]
}
```

**プロンプト構成**:

```
FASHION EDITORIAL, 3:4 vertical composition, product-forward photography.

{VIEW INSTRUCTIONS}
- SIDE: 90° profile, torso perpendicular, show side seam/sleeve
- BACK: 180° rear view, no face, show back construction

GARMENT IDENTITY (same as main image):
Type: {garment_type}
Silhouette: {silhouette}
Length: {length}
...

COLOR PALETTE (exact colors from main image):
{palette_hex joined}

CRITICAL DETAILS (MUST appear):
- {invariant_details[0]}
- {invariant_details[1]}
...

CRITICAL CONSISTENCY REQUIREMENTS:
- This is exactly the same garment as the main front view
- Same colors, same materials, same silhouette, same details
- Only the camera angle has changed
...

ABSTRACT CONSTRUCTION LANGUAGE ONLY:
- Seams, panels, pleats, quilting, piping, appliqués
- NO logos, NO text, NO cultural symbols
```

**negative_prompt**:
- SIDE: `"front view, frontal pose, face looking at camera, ..."`
- BACK: `"front view, face visible, side view, eyes, nose, ..."`

---

## クライアント側実装フロー

### 推奨フロー

1. **ジョブ作成**
   ```typescript
   const res = await fetch('/api/fusion/start-variants', {
     method: 'POST',
     body: JSON.stringify({ genId, userId, views: ['side', 'back'] })
   });
   const { jobs } = await res.json();
   ```

2. **SSE接続開始**
   ```typescript
   const eventSource = new EventSource(`/api/fusion/variants-stream?genId=${genId}`);
   eventSource.onmessage = (e) => {
     const data = JSON.parse(e.data);
     if (data.type === 'variants_update') {
       // UI更新
     }
     if (data.type === 'all_complete') {
       eventSource.close();
     }
   };
   ```

3. **並列生成開始**
   ```typescript
   await Promise.all(
     jobs.map(job =>
       fetch('/api/fusion/variants-generate', {
         method: 'POST',
         body: JSON.stringify({ job_id: job.id })
       })
     )
   );
   ```

**注意**: SSEは生成を実行しない（通知のみ）。実際の生成は`variants-generate`が行う。

---

## 重要な実装ポイント

### 1. タイムアウト対策

- **問題**: 2画像同時生成で180秒を超える
- **解決**: ジョブ単位で分割（1ジョブ=120秒以内）
- `start-variants`は登録のみ、`variants-generate`が実際生成

### 2. demographic の扱い

- **重要**: 必ず`generation_history.demographic`を参照
- ユーザーがトグルで選択した値を尊重
- ジョブ作成時にコピーするが、生成時は再取得して上書き

```typescript
// variants-generate での実装
const { data: genData } = await supabase
  .from('generation_history')
  .select('demographic')
  .eq('id', job.gen_id)
  .single();

if (genData?.demographic) {
  demographic = genData.demographic; // 上書き
}
```

### 3. design_tokens の取得

- ジョブに含まれていればそれを使用
- なければ`generation_history`から取得
- 事前に`/api/fusion/extract-tokens`を実行している前提

### 4. SSE all_complete のタイミング

**修正済み**:
```typescript
const allDone = currentVariants.every(v =>
  v.status === 'completed' || v.status === 'failed'
);

// 重要: ジョブ数が揃うまで待つ
if (allDone && currentVariants.length >= expectedJobCount) {
  // all_complete 送信
}
```

### 5. R2公開URLの生成

```typescript
const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL
  || process.env.R2_PUBLIC_BASE_URL
  || 'https://assets.open-wardrobe-market.com';
const url = `${publicBaseUrl}/${key}`;
```

**修正済み**: フォールバックチェーンで安全性確保

---

## デバッグ・ログ

### 推奨ログポイント

```typescript
// start-variants
console.log(`[start-variants] Creating jobs for ${genId}:`, views);
console.log(`[start-variants] ✅ Created ${jobs.length} jobs`);

// variants-generate
console.log(`[variants-generate] Processing job ${job_id}`);
console.log(`[variants-generate] ✅ Fetched design_tokens:`, { garment_type, colors });
console.log(`[variants-generate] Generating ${view} with Imagen 3...`);
console.log(`[variants-generate] Uploaded ${view}: ${url}`);
console.log(`[variants-generate] ✅ Completed ${view} for ${genId}`);

// variants-stream
console.log(`[variants-stream] Client connected for ${genId}`);
console.log(`[variants-stream] Variants updated:`, currentVariants);
console.log(`[variants-stream] All variants completed (${count}/${expected})`);
```

---

## 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=https://assets.open-wardrobe-market.com
NEXT_PUBLIC_R2_PUBLIC_BASE_URL=https://assets.open-wardrobe-market.com

# Google Cloud (Imagen 3.0)
GOOGLE_CLOUD_PROJECT=
GOOGLE_APPLICATION_CREDENTIALS=
```

---

## 既知の問題と解決策

### 問題1: design_tokens が null

**原因**: `extract-tokens` API未実行
**解決**: 生成後に自動実行するか、variants開始前にチェック

### 問題2: all_complete が早すぎる

**原因**: variants配列の長さチェック不足
**解決済み**: `currentVariants.length >= expectedJobCount` 追加

### 問題3: demographic が反映されない

**原因**: ジョブのdemographicを使用していた
**解決済み**: 生成時に`generation_history.demographic`を再取得

### 問題4: R2 URL が404

**原因**: 環境変数の優先順位ミス
**解決済み**: フォールバック追加（NEXT_PUBLIC優先）

---

## テスト手順

### 1. ジョブ作成テスト

```bash
curl -X POST http://localhost:3000/api/fusion/start-variants \
  -H "Content-Type: application/json" \
  -d '{"genId":"YOUR_GEN_ID","userId":"YOUR_USER_ID"}'
```

### 2. 単一生成テスト

```bash
curl -X POST http://localhost:3000/api/fusion/variants-generate \
  -H "Content-Type: application/json" \
  -d '{"job_id":"JOB_UUID"}'
```

### 3. SSE接続テスト

```bash
curl -N http://localhost:3000/api/fusion/variants-stream?genId=YOUR_GEN_ID
```

### 4. DB確認

```sql
-- ジョブ確認
SELECT id, gen_id, type, status, attempts, created_at
FROM variants_jobs
WHERE gen_id = 'YOUR_GEN_ID'
ORDER BY created_at DESC;

-- 結果確認
SELECT id, variants, demographic, design_tokens
FROM generation_history
WHERE id = 'YOUR_GEN_ID';
```

---

## マイグレーション履歴

1. **`add_fusion_variant_columns.sql`** - generation_historyに新規カラム追加
2. **`create_variants_jobs.sql`** - variants_jobsテーブル作成

### 実行方法

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.etvmigcsvrvetemyeiez.supabase.co:5432/postgres" \
  -f migrations/add_fusion_variant_columns.sql

PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.etvmigcsvrvetemyeiez.supabase.co:5432/postgres" \
  -f migrations/create_variants_jobs.sql
```

---

## 今後の拡張案

1. **バッチ生成**: 複数genIdを一括処理
2. **リトライロジック**: 失敗ジョブの自動再試行
3. **キャッシング**: 同じdesign_tokensの結果を再利用
4. **品質検証**: 生成画像の自動品質チェック（view_conf, sim_score）
5. **A/Bテスト**: 異なるguidanceScaleでの生成比較

---

## 参考リンク

- [Imagen 3.0 Documentation](app/api/fusion/variants-generate/route.ts)
- [SSE Specification](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

---

---

## フロントエンド実装

### アプリケーション構造

**メインアプリ**: [src/app/MobileApp.tsx](src/app/MobileApp.tsx)
- SPAルーティング（ブラウザ履歴管理）
- 認証状態管理（AuthProvider）
- Urulaプロファイル管理（UrulaProvider）
- WebView検出と警告表示

### ページ構成

#### 1. STUDIO（ホーム）- [MobileHomePage.tsx](src/app/pages/mobile/MobileHomePage.tsx)

**役割**: レコメンデーション表示とメインナビゲーション

**機能**:
- ユーザー生成画像と公開カタログの統合表示
- カードスワイパーUI（3.6秒自動スクロール）
- 詳細モーダル（いいね、公開/非公開、削除）
- CTA: "CREATE"へ誘導

**データ取得**:
```typescript
// 自分の画像（最新30件）
fetchAssetsFromApi({ scope: 'mine', kind: 'raw', limit: 30 })

// 公開カタログ（最新60件）
fetchAssetsFromApi({ scope: 'public', kind: 'final', limit: 60 })
```

**表示ロジック**:
1. 両方のデータをマージ
2. 重複排除（IDベース）
3. ランダムシャッフル
4. 上位10件を表示

---

#### 2. CREATE - ルーター [MobileCreateRouter.tsx](src/app/pages/mobile/MobileCreateRouter.tsx)

**役割**: 生成モードの振り分け

**対応モード**:
- **FUSION** → [MobileFusionPage.tsx](src/app/pages/mobile/MobileFusionPage.tsx) ✅ 実装済み
- **COMPOSER** → MobileCreatePage.tsx ✅ 実装済み
- **CAMERA** → Coming Soon（カメラからテクスチャ抽出）
- **SKETCH** → Coming Soon（スケッチから生成）
- **PROMPT** → Coming Soon（フリーテキスト入力）
- **REMIX** → Coming Soon（既存デザインのリミックス）
- **VARIATIONS** → Coming Soon（カラーウェイ/トリム変更）

**モード選択**:
- URL: `/create?mode=fusion`
- localStorage: `owm-create-mode`

---

#### 3. FUSION PAGE - [MobileFusionPage.tsx](src/app/pages/mobile/MobileFusionPage.tsx)

**役割**: 2画像アップロード→AI分析→FUSION生成

**フロー**:

1. **画像アップロード（upload）**
   - 2枚の画像を選択（カメラ/ギャラリー）
   - ファイル→Base64変換
   - プレビュー表示

2. **AI分析（analyzing）**
   - `/api/gemini/analyze-fusion` にBase64送信
   - Gemini 2.0 Flashで画像分析
   - FusionSpec抽出（色、シルエット、モチーフ抽象化）
   - DNA生成（Urula用パラメータ）

3. **プレビュー（preview）**
   - 抽出されたFusionSpecを表示
   - 性別選択（mens/womens）
   - オプションプロンプト入力
   - Urulaメタボール表示（DNA可視化）

4. **生成開始（generating）**
   - `/api/nano/generate` に送信
   - Imagen 3.0で画像生成
   - R2アップロード
   - generation_historyに保存

5. **リビール（revealing）**
   - GlassRevealCanvas（グラスモーフィズムエフェクト）
   - 徐々に画像を表示（3秒アニメーション）

6. **完了（done）**
   - バリアント生成ボタン表示
   - 公開ボタン表示
   - 再生成/別画像で試すボタン

**重要な実装**:

```typescript
interface FusionSpec {
  palette: { name: string; hex: string; weight: number }[];
  silhouette: string;
  materials: string[];
  motif_abstractions: MotifAbstraction[];
  details: string[];
  inspiration?: string;
}

interface MotifAbstraction {
  source_cue: string;      // "Image 1の幾何学パターン"
  operation: string;       // "抽象化して配置"
  placement: string[];     // ["フロントパネル", "袖口"]
  style: string;           // "ミニマル・グラフィック"
  scale: string;           // "小さく散りばめる"
  notes: string;
}
```

---

#### 4. ARCHIVE（マイページ）- [MobileMyPage.tsx](src/app/pages/mobile/MobileMyPage.tsx)

**役割**: ユーザー作品とコレクション管理

**セクション**:
- **DESIGN**: 作品管理
  - Publish: 公開済み作品
  - Drafts: 下書き（非公開）
  - Collections: いいねした作品
- **SETTING**: プロフィール設定（準備中）

**機能**:
- 公開/非公開切り替え（楽観的UI更新）
- 削除（確認モーダル付き）
- いいね/いいね解除
- ARCHIVEから公開フローへ遷移

**データ取得**:
```typescript
// 自分の作品
fetchAssetsFromApi({ scope: 'mine', kind: 'raw', limit: 80 })

// いいねした作品
fetchAssetsFromApi({ scope: 'liked', kind: 'final', limit: 80 })
```

**アカウント管理**:
- プロフィール名クリックでメニュー表示
- 「アカウント追加」→ サインアップへ
- 「アカウント切り替え」→ ログインへ
- ローカルセッションクリアして遷移

---

#### 5. その他のページ

**SHOWCASE（ギャラリー）** - MobileGalleryPage.tsx
- 公開カタログのグリッド表示
- フィルター/検索機能

**公開フロー**:
- MobilePublishFormPage.tsx: タイトル・価格・タグ入力
- MobilePublishCompletePage.tsx: 公開完了画面

---

### 共通コンポーネント

#### MobileLayout - [MobileLayout.tsx](src/app/components/mobile/MobileLayout.tsx)
- ヘッダー（ロゴ、メニューボタン）
- ボトムナビゲーション
- メインコンテンツエリア

#### MenuOverlay - [MenuOverlay.tsx](src/app/components/mobile/MenuOverlay.tsx)
- 全画面メニュー
- ナビゲーションリンク（STUDIO, CREATE, ARCHIVE, SHOWCASE）
- FAQ/Privacy/Contact

#### MobileDetailModal - [MobileDetailModal.tsx](src/app/components/mobile/MobileDetailModal.tsx)
- 画像詳細表示
- 作品情報（タイトル、作者、タグ、価格）
- アクション（いいね、購入、公開/非公開、削除）
- 類似作品グリッド
- オーナー専用機能（isDraft判定）

#### CardSwiper - [CardSwiper.tsx](src/app/components/mobile/CardSwiper.tsx)
- 横スクロールカードUI
- 自動スクロール（3.6秒間隔）
- ドット付きページネーション
- スワイプ操作対応

---

### DNA & Urula システム

#### DNA型定義 - [src/types/dna.ts](src/types/dna.ts)

```typescript
export type DNA = {
  // カラー（0..1）
  hue: number;      // HSL色相
  sat: number;      // 彩度
  light: number;    // 明度

  // スタイル軸（-1..1）
  minimal_maximal: number;   // ミニマル ↔ マキシマル
  street_luxury: number;     // ストリート ↔ ラグジュアリー
  oversized_fitted: number;  // オーバーサイズ ↔ フィット
  relaxed_tailored: number;  // リラックス ↔ テーラード

  // テクスチャ（0..1）
  texture: number;           // 0=スムース, 1=リブパターン
};

export const DEFAULT_DNA: DNA = {
  hue: 0.95,    // ペールピンク
  sat: 0.3,     // 低彩度
  light: 0.75,  // 高明度
  minimal_maximal: 0,
  street_luxury: 0,
  oversized_fitted: 0,
  relaxed_tailored: 0,
  texture: 0    // ガラス質感
};
```

#### Urulaコンテキスト - [src/app/lib/UrulaContext.tsx](src/app/lib/UrulaContext.tsx)

**役割**: ユーザープロファイルとDNAの永続化

**機能**:
- Supabase `user_urula_profile` テーブルと同期
- `evolve(dna: DNA)`: DNA変更をサーバーに保存
- `profile`: 現在のプロファイル（DNA, 統計情報）

**使用例**:
```typescript
const { profile, evolve } = useUrula();

// DNA更新
await evolve(newDNA);

// プロファイル表示
<MetaballsBreathing dna={profile?.current_dna || DEFAULT_DNA} />
```

#### Metaballs可視化

**MetaballsBreathing** - [src/components/Urula/MetaballsBreathing.tsx](src/components/Urula/MetaballsBreathing.tsx)
- Three.js + R3F
- DNAからグラデーション生成
- texture値でリブパターン適用
- アニメーション（呼吸エフェクト）

---

### データフロー

#### アセット管理 - [src/app/lib/api/assets.ts](src/app/lib/api/assets.ts)

```typescript
// 取得
fetchAssets({
  scope: 'mine' | 'public' | 'liked',
  kind: 'raw' | 'final',
  limit: number
})

// 更新
updateAssetStatus(assetId, 'public' | 'private')

// 削除
deleteAsset(assetId)

// いいね
toggleLike(assetId, shouldLike: boolean)
```

#### 生成フロー

1. **FUSION分析**
   ```
   [画像1, 画像2] → /api/gemini/analyze-fusion
   → FusionSpec + DNA
   ```

2. **画像生成**
   ```
   FusionSpec + DNA → /api/nano/generate
   → Imagen 3.0 → R2 → generation_history
   ```

3. **バリアント生成**
   ```
   genId → /api/fusion/start-variants
   → variants_jobs作成
   → /api/fusion/variants-generate (並列実行)
   → SIDE/BACK画像生成
   → SSE通知 (/api/fusion/variants-stream)
   ```

4. **公開**
   ```
   generation_history → /api/publish
   → published_items + ポスター合成
   ```

---

### 認証フロー - [src/app/lib/AuthContext.tsx](src/app/lib/AuthContext.tsx)

**Supabase Auth**:
- Google OAuth
- Email/Password
- セッション管理（localStorage）

**認証状態**:
```typescript
const { user, loading, signIn, signOut } = useAuth();
```

**保護されたルート**:
- `/create` → 要ログイン
- `/archive` → 要ログイン
- `/studio` → ログアウト時はログインページ表示

---

### スタイリング

**CSSアーキテクチャ**:
- コンポーネント単位のCSS（MobileApp.css, MobileFusionPage.css等）
- グローバル変数:
  ```css
  --bg-main: #EEECE6;
  --text-main: #1A1A1A;
  --accent: #000;
  --font-en: 'Montserrat', sans-serif;
  --font-ja: 'Noto Sans CJK JP', sans-serif;
  ```

**レスポンシブ**:
- モバイルファースト（375px基準）
- タブレット: 768px+
- デスクトップ: 1024px+（現在は非対応）

---

### エラーハンドリング

**WebView警告** - [WebViewWarning.tsx](src/app/components/mobile/WebViewWarning.tsx)
- Instagram/LINE等のアプリ内ブラウザを検出
- Safari/Chromeで開くよう促す

**エラーメッセージ** - [constants/copy.ts](constants/copy.ts)
```typescript
export const COPY = {
  errors: {
    uploadFailed: 'アップロードに失敗しました',
    updateFailed: '更新に失敗しました',
    deleteFailed: '削除に失敗しました',
    like: 'いいねに失敗しました'
  }
}
```

**トースト通知**:
```typescript
const showToast = (message: string) => {
  // 2秒間表示するトースト
  // fadeInUp/fadeOutDownアニメーション
};
```

---

### パフォーマンス最適化

1. **画像遅延読み込み**
   ```tsx
   <img src={asset.src} loading="lazy" />
   ```

2. **テクスチャプリロード**
   ```typescript
   // MobileApp起動時
   loadUrulaTextures().catch(err => console.error(err));
   ```

3. **楽観的UI更新**
   ```typescript
   // いいね即座に反映 → API呼び出し → エラー時revert
   ```

4. **SSE接続管理**
   - 90秒自動クローズ
   - クライアント切断時のクリーンアップ
   - Keep-aliveピング（15秒間隔）

---

### デバッグ情報

**ログ出力**:
```typescript
console.log('[MobileFusionPage] Stage changed to:', stage);
console.log('[MobileHomePage] Failed to load assets:', error);
```

**開発者ツール**:
- React DevTools: コンポーネント階層確認
- Network: API通信確認（SSEストリーム含む）
- Console: エラー・ログ確認

**状態確認**:
```typescript
// localStorage
localStorage.getItem('owm-create-mode')
localStorage.getItem('owm-login-mode')

// Supabase session
supabase.auth.getSession()
```

---

## 変更履歴

- **2025-11-25**: フロントエンド実装セクション追加（全ページ・コンポーネント構成）
- **2025-11-25**: all_complete タイミング修正（expectedJobCount チェック追加）
- **2025-11-25**: demographic 取得ロジック修正（generation_history優先）
- **2025-11-25**: R2 公開URL生成のフォールバック追加
- **2025-11-24**: 初回実装完了（ジョブ分割アーキテクチャ）

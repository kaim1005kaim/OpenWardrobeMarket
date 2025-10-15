# Open Wardrobe Market (OWM) - アーキテクチャ概要

## サービス概要
AIによるファッションデザイン生成とマーケットプレイスを統合したWebアプリケーション。
ユーザーは質問に答えてデザインを生成し、生成した作品をギャラリーに公開できる。

---

## フロントエンド

### 技術スタック
- **Framework**: React 18
- **Build Tool**: Vite 4.5.14
- **UI**: モバイルファースト設計
- **3D/WebGL**: Three.js + React Three Fiber
- **State Management**: React Hooks
- **Routing**: クライアントサイドルーティング (onNavigate prop pattern)
- **Styling**: CSS Modules + Tailwind CSS

### 主要ページ構成

#### 1. HOME (MobileHomePage)
- ギャラリー表示（公開作品一覧）
- ビューモード切り替え: Poster / Clean
- 無限スクロール対応
- 検索機能

#### 2. CREATE (MobileCreatePage / MobileCreateTopPage)
**生成フロー:**
```
トップページ → 質問回答 → 生成中 → リビールエフェクト → 完成
```

**質問フロー (5ステップ):**
1. 雰囲気 (vibe): minimal, street, luxury, outdoor, workwear, athleisure
2. シルエット (silhouette): oversized, fitted, loose, tailored, relaxed
3. カラーパレット (color): black, white, navy, earth, pastel, neon, monochrome (複数選択可)
4. 着用シーン (occasion): casual, business, formal, sports, outdoor
5. シーズン (season): spring/summer, autumn/winter, resort, all season

**ビジュアルエフェクト:**
- **MetaballsSoft**: アニメーション背景（20種類のパターン）
- **GlassRevealCanvas**: ガラスストライプシャッターエフェクト
  - フェードイン: 400ms
  - ホールド: 3000ms
  - リビール: 1200ms (左→右)
  - 安定期間: 700ms

**状態管理:**
```typescript
Stage: "idle" | "generating" | "revealing"
- idle: 質問回答中
- generating: AI生成中（MetaballsSoft表示）
- revealing: GlassRevealCanvasによるリビール
```

**DNA システム:**
```typescript
DNA = {
  hue: 0..1,           // 色相
  sat: 0..1,           // 彩度
  light: 0..1,         // 明度
  minimal_maximal: -1..1,
  street_luxury: -1..1,
  oversized_fitted: -1..1,
  relaxed_tailored: -1..1,
  texture: 0..1
}
```
- ユーザーの選択を連続値に変換
- 1.2秒ごとに自動保存 (`/api/dna-sync`)

#### 3. MYPAGE (MobileMyPage)
**タブ構成:**
- **Publish**: 公開済み作品
- **Drafts**: 下書き（非公開）
- **Collections**: いいねした作品

**機能:**
- プロフィール表示
- アセット一覧表示
- ステータス変更（公開/非公開）
- 削除機能

#### 4. GALLERY (MobileGalleryPage)
- 公開作品の閲覧
- ポスター合成表示
- 無限スクロール
- 詳細モーダル表示

---

## バックエンド

### 技術スタック
- **Framework**: Next.js 15.5.2 (App Router)
- **Runtime**: Node.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (S3互換)
- **AI**: Google Gemini 2.0 Flash Image Generation
- **Authentication**: Supabase Auth

### API Routes

#### 画像生成フロー
```
POST /api/generate
  ↓
1. プロンプト生成 (buildPrompt)
2. Gemini API呼び出し
3. Base64画像を取得
4. Blob URL作成（即座にフロントへ返却）
  ↓
[バックグラウンド処理]
5. R2プリサインURL取得 (GET /api/r2-presign)
6. R2へアップロード
7. generation_history に保存
8. finalUrl をフロントに通知
```

**レスポンス:**
```typescript
{
  key: string,           // R2のキー
  blobUrl: string,       // blob:// URL (即座に表示用)
  finalUrl: string,      // R2の公開URL (アップロード後)
  mimeType: string,
  answers: Answers,
  dna: DNA,
  prompt: string
}
```

#### 公開フロー
```
POST /api/publish
  ↓
1. generation_history を検索 (image_url で)
2. images テーブルにレコード作成
3. generation_history.is_public = true に更新
4. published_items にレコード作成
  ↓
ギャラリーに表示
```

#### 主要エンドポイント

**`GET /api/assets`**
- **scope**: `public` | `mine` | `liked`
- **kind**: `raw` | `final`
- 複数テーブルから統合取得:
  - `scope=public`: `assets` + `published_items` (is_active=true)
  - `scope=mine`: `assets` + `published_items` (user_id)
  - `scope=liked`: `assets` + `likes` join

**`POST /api/generate`**
- Gemini Image Generation API呼び出し
- プロンプト構築 (answers + DNA)
- 画像生成とR2アップロード

**`POST /api/publish`**
- `generation_history` → `images` → `published_items`
- is_public フラグ更新

**`POST /api/dna-sync`**
- DNA + answers の自動保存
- 1.2秒デバウンス

**`GET /api/r2-presign`**
- R2アップロード用プリサインURL生成

**`GET /api/catalog`**
- カタログ画像一覧

---

## データベース設計

### 主要テーブル

#### `generation_history`
```sql
id                uuid primary key
user_id           uuid references auth.users
provider          text default 'gemini'
model             text default 'gemini-2.5-flash-image'
prompt            text
image_url         text                -- R2公開URL
image_path        text                -- R2キー
folder            text default 'usergen'
generation_data   jsonb               -- DNA + answers
is_public         boolean default false
published_at      timestamptz
created_at        timestamptz default now()
```

#### `images`
```sql
id              uuid primary key
user_id         uuid references auth.users
r2_url          text not null
r2_key          text not null
title           text
description     text
width           integer
height          integer
mime_type       text
tags            text[]
colors          text[]
price           decimal(10, 2)
is_public       boolean default false
created_at      timestamptz default now()
```

#### `published_items`
```sql
id              uuid primary key
user_id         uuid references auth.users
image_id        uuid references images
title           text not null
description     text
price           decimal(10, 2) not null default 0
tags            text[]
colors          text[]
category        text
is_active       boolean default true
poster_url      text
original_url    text
sale_type       text check (sale_type in ('buyout', 'subscription'))
views           integer default 0
likes           integer default 0
created_at      timestamptz default now()
```

#### `assets`
```sql
id              uuid primary key
user_id         uuid references auth.users
status          text                -- 'public' | 'private' | 'draft'
final_key       text
final_url       text
raw_key         text
raw_url         text
tags            text[]
price           decimal
metadata        jsonb
created_at      timestamptz default now()
```

---

## ストレージ構造 (Cloudflare R2)

### ディレクトリ構造
```
usergen/{user_id}/{YYYY}/{MM}/{timestamp}_{uuid}.png
catalog/{category}/{filename}.png
poster/BG/poster_BG/{a-q}.png
```

### アクセスパターン
1. **生成時**: プリサインURLで直接アップロード
2. **表示時**: 公開URL (`https://assets.open-wardrobe-market.com/...`)
3. **Blob → R2遷移**:
   - 即座に blob:// で表示
   - バックグラウンドでR2アップロード
   - 完了後に公開URLへ切り替え

---

## 画像表示フロー

### useDisplayImage Hook
```typescript
{
  blobUrl: string,    // 即座に表示
  finalUrl: string    // R2 URL (プリロード後に切り替え)
}
```

**動作:**
1. blobUrl を即座に表示
2. finalUrl をバックグラウンドでプリロード（HEAD + Image.onload）
3. プリロード完了後、finalUrl に切り替え
4. blobUrl を revoke

### アスペクト比
- **生成画像**: 1024x1024 (正方形)
- **コンテナ**: `height: calc(100vw)` で正方形を維持

---

## 認証・セキュリティ

### Supabase Auth
- **Provider**: Email/Password, OAuth (Google, GitHub等)
- **Row Level Security (RLS)**: 全テーブルで有効
- **ポリシー**:
  - `published_items`: 誰でも閲覧可、所有者のみ編集
  - `generation_history`: 所有者のみアクセス
  - `images`: is_public=true なら公開

### API認証
```typescript
Authorization: Bearer {supabase_access_token}
```

---

## デプロイ構成

### Vercel
- **Frontend**: Vite SPA (`public/spa/`)
- **Backend**: Next.js API Routes (`app/api/`)
- **Build Process**:
  1. `tsc` (型チェック)
  2. `vite build` (SPAビルド)
  3. `copy-spa.mjs` (public/spa/へコピー、/assets/ → /spa/assets/)
  4. `next build` (APIルートビルド)

### 環境変数
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# R2
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_REGION
R2_S3_ENDPOINT
R2_PUBLIC_BASE_URL

# AI
GEMINI_API_KEY
```

---

## パフォーマンス最適化

### 画像最適化
- Lazy loading (最初の6枚は eager)
- R2 CDN配信
- WebP対応（予定）

### WebGL最適化
- `powerPreference: "high-performance"`
- `setPixelRatio(Math.min(devicePixelRatio, 1.75))`
- アニメーション完了後も描画継続（エフェクトOFF状態維持）

### APIキャッシュ
- `revalidate: 0` (常に最新データ)

---

## 既知の課題

1. **WebGL Context Lost**: 複数のMetaballsSoftが同時実行されるとContext Lostが発生
2. **二重生成**: React Strict Modeまたは二重クリックで2枚生成される可能性
3. **テーブル統合**: `assets`, `images`, `published_items`, `generation_history` が別々に存在

---

## 今後の改善予定

- [ ] 生成フローの最適化
- [ ] WebGL Context Lost 問題の解決
- [ ] データベーススキーマの統合
- [ ] ポスター合成の高速化
- [ ] プレビュー画像生成（透かし）

---

## 技術的な特徴

### 強み
- **即座のフィードバック**: Blob URL による瞬時の画像表示
- **リッチなエフェクト**: Three.js による高品質なビジュアル
- **スケーラブル**: Cloudflare R2 + Vercel の組み合わせ
- **型安全**: TypeScript による堅牢性

### 課題
- **複雑な状態管理**: 複数テーブルの統合が必要
- **WebGLリソース管理**: コンテキストロストの問題
- **ビルド複雑性**: Vite + Next.js のハイブリッド構成


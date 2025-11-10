# Open Wardrobe Market - 完全仕様詳細書

> **AIファッションデザイン生成・マーケットプレイスプラットフォーム**
> Version: 0.1.0 | Last Updated: 2025-11-10

---

## 📝 最新の変更点 (v0.1.0)

### 主要な追加機能

**1. CREATEモード統合実装（FUSION主導）**
- **FUSION**: 2画像合成をデフォルトモードに設定
- **6つの追加モード**: COMPOSER, FREESTYLE, REMIX, EVENT, PALETTE, VOICE
- Settings画面でモード切替可能
- 統一されたフロー: SELECT → REVIEW → GENERATE → REVEAL → PUBLISH

**2. Urula（メタボール）システム**
- ユーザー個別の視覚的嗜好を3Dメタボールで表現
- 生成履歴に基づく色彩・素材・形状の蓄積学習
- 全CREATEステージでインタラクティブ表示
- タップ/スワイプによるインタラクション

**3. 新規API群**
- `/api/fusion/analyze`: Gemini Visionによる2画像分析
- `/api/fusion/compose`: プロンプト自動合成
- `/api/guidance/interpret`: 自由文の意図解釈
- `/api/urula/state`, `/api/urula/apply`: Urula状態管理

**4. GlassRevealCanvas（演出エフェクト）**
- ガラスストライプシャッター演出（5.3秒タイムライン）
- 全CREATEモードのREVEALステージで使用

**5. UI文言規約（Trajan ALL CAPS）**
- ページタイトル・CTAボタンは英語大文字表記に統一
- 例: HOME / GALLERY / CREATE / GENERATE / REVEAL / PUBLISH

**6. データベーススキーマ拡張**
- `generation_history`: `prompt`, `negative`, `answers`, `dna`, `chip_tags`, `source_mode`追加
- `user_urula_state`: 新規テーブル（色/素材/形状嗜好）
- `event_briefs`, `event_submissions`: イベント機能用テーブル
- `published_items`: `gen_id`参照追加

**7. プロンプト合成テンプレート**
- 構造化されたプロンプト生成ルール
- 色・素材・柄・形状の自動ブレンド
- Guidanceチップ統合

---

## 📋 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [技術スタック詳細](#3-技術スタック詳細)
4. [機能仕様](#4-機能仕様)
5. [データベース設計](#5-データベース設計)
6. [API仕様](#6-api仕様)
7. [フロントエンド実装](#7-フロントエンド実装)
8. [バックエンド実装](#8-バックエンド実装)
9. [AI統合](#9-ai統合)
10. [認証・セキュリティ](#10-認証セキュリティ)
11. [デプロイメント](#11-デプロイメント)
12. [開発ガイド](#12-開発ガイド)
13. [パフォーマンス最適化](#13-パフォーマンス最適化)
14. [今後の拡張予定](#14-今後の拡張予定)

---

## 1. プロジェクト概要

### 1.1 プロジェクトビジョン

**Open Wardrobe Market**は、AI技術を活用した次世代のファッションデザイン生成・共有プラットフォームです。ユーザーは自然言語での対話を通じて、独自のファッションデザインを簡単に作成し、マーケットプレイスで公開・共有できます。

### 1.2 コアバリュー

- 🎨 **クリエイティビティの民主化**: 専門知識なしでプロレベルのデザイン制作
- 🤖 **AI駆動の直感的体験**: 自然言語での会話による簡単デザイン生成
- 🌐 **コミュニティ主導**: ユーザー同士のデザイン共有とインスピレーション
- 📊 **データドリブン**: 個人の嗜好分析と最適な推薦システム
- 🚀 **高性能**: 最新技術による高速・スケーラブルな実装

### 1.3 主要機能サマリー

| カテゴリ | 機能 | 説明 |
|---------|------|------|
| 🎨 **デザイン生成** | 対話型AI生成 | DeepSeek + ImagineAPIによる高品質デザイン |
| 🔍 **検索・発見** | マルチモーダル検索 | テキスト、画像、タグ、カラーでの複合検索 |
| 📊 **分析** | 個人・全体分析 | 生成履歴、トレンド、エンゲージメント分析 |
| 🎯 **推薦** | パーソナライズ | 個人嗜好に基づくインテリジェント推薦 |
| 📤 **エクスポート** | 高解像度出力 | PNG/JPEG/WebP、4段階品質設定 |
| 🌐 **シェア** | SNS連携 | Twitter/Instagram/Pinterest等への共有 |
| 👤 **ユーザー管理** | ギャラリー | 生成済み・公開済み・保存済みアイテム管理 |

---

## 2. システムアーキテクチャ

### 2.1 全体アーキテクチャ図

```
┌────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React 18 + TypeScript + Tailwind CSS                    │  │
│  │  - SPA (Single Page Application)                         │  │
│  │  - Mobile-First Responsive Design                        │  │
│  │  - Real-time SSE Communication                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      CDN & Edge Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Vercel Edge Network                                     │  │
│  │  - Static Asset Caching                                  │  │
│  │  - Edge Functions (Middleware)                           │  │
│  │  - Global CDN Distribution                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Application Layer                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 API Routes (Serverless)                      │  │
│  │  ├─ /api/chat              (AI対話)                      │  │
│  │  ├─ /api/nano-generate     (画像生成)                    │  │
│  │  ├─ /api/generate-embedding(ベクトル検索)                │  │
│  │  ├─ /api/analytics         (分析)                        │  │
│  │  ├─ /api/catalog           (カタログ管理)                │  │
│  │  ├─ /api/dna              (スタイルDNA)                  │  │
│  │  └─ /api/ops              (運用管理)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                    ▼                    ▼
┌─────────────────────────────┐ ┌──────────────────────────────┐
│    Database Layer           │ │   Storage Layer              │
│  ┌──────────────────────┐   │ │  ┌───────────────────────┐   │
│  │  Supabase            │   │ │  │  Cloudflare R2        │   │
│  │  - PostgreSQL 15     │   │ │  │  - Image Storage      │   │
│  │  - Row Level Security│   │ │  │  - CDN Integration    │   │
│  │  - Real-time Subs    │   │ │  │  - S3 Compatible API  │   │
│  │  - Auth (JWT)        │   │ │  └───────────────────────┘   │
│  │  - pgvector Extension│   │ │                              │
│  └──────────────────────┘   │ └──────────────────────────────┘
└─────────────────────────────┘
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                    External AI Services                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  DeepSeek AI    │  │  ImagineAPI     │  │  CLIP Server  │  │
│  │  - Prompt Gen   │  │  - Image Gen    │  │  - Embeddings │  │
│  │  - Chat API     │  │  - Webhook      │  │  - Similarity │  │
│  └─────────────────┘  └─────────────────┘  └───────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 データフロー

#### 2.2.1 ファッションデザイン生成フロー

```
[ユーザー入力]
    ↓
[DeepSeek AIプロンプト生成]
    ↓ (最適化されたプロンプト)
[ImagineAPI画像生成リクエスト]
    ↓
[Webhook受信 → Supabase更新]
    ↓
[SSE経由でフロントエンドへリアルタイム通知]
    ↓
[画像をR2にアップロード]
    ↓
[CLIP Serverでembedding生成]
    ↓
[データベースに保存・公開]
```

#### 2.2.2 検索・推薦フロー

```
[ユーザー検索クエリ/画像]
    ↓
[CLIP Server: embedding生成]
    ↓
[PostgreSQL: pgvectorでベクトル類似度検索]
    ↓
[フィルタリング (タグ、カラー、価格)]
    ↓
[ソート (関連度、人気、日時)]
    ↓
[結果返却]
```

### 2.3 技術的な設計判断

| 決定事項 | 選定技術 | 理由 |
|---------|---------|------|
| フロントエンド | React 18 + Vite | 高速HMR、最新機能、開発体験 |
| バックエンド | Next.js 15 API Routes | サーバーレス、型共有、Edge対応 |
| データベース | Supabase (PostgreSQL) | RLS、リアルタイム、認証統合 |
| ストレージ | Cloudflare R2 | 低コスト、高速、S3互換 |
| AI画像生成 | ImagineAPI | 高品質、Webhook対応、安定性 |
| プロンプト生成 | DeepSeek AI | コスト効率、日本語対応 |
| ベクトル検索 | pgvector + CLIP | 高精度、オープンソース |

---

## 3. 技術スタック詳細

### 3.1 フロントエンド

#### 3.1.1 コアライブラリ

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^7.9.3",
  "typescript": "^5.0.2",
  "vite": "^4.4.5"
}
```

**特徴:**
- React 18の並行レンダリング機能
- TypeScriptによる型安全性
- Viteによる高速開発体験 (HMR < 100ms)

#### 3.1.2 スタイリング

```json
{
  "tailwindcss": "^3.3.3",
  "autoprefixer": "^10.4.14",
  "postcss": "^8.4.27",
  "lucide-react": "^0.542.0"
}
```

**カスタムTailwind設定:**
```javascript
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: '#FF7A1A',
        ink: {
          900: '#111111',
          700: '#3A3A3A',
          400: '#777777',
          200: '#EAEAEA'
        }
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px'
      }
    }
  }
}
```

#### 3.1.3 3D/アニメーション

```json
{
  "@react-three/fiber": "^8.18.0",
  "@react-three/drei": "^9.122.0",
  "three": "^0.180.0",
  "@react-spring/web": "^10.0.3"
}
```

**用途:**
- ローディングアニメーション (メタボールエフェクト)
- インタラクティブUI要素
- スムーズなトランジション

### 3.2 バックエンド

#### 3.2.1 Next.js API Routes構成

```
app/api/
├── _shared/              # 共通ユーティリティ
│   ├── supabase.ts      # Supabase クライアント
│   └── auth.ts          # 認証ヘルパー
├── chat/route.ts        # AI対話エンドポイント
├── nano-generate/route.ts  # 画像生成
├── generate-embedding/route.ts  # ベクトル生成
├── analytics/route.ts   # 分析データ
├── catalog/route.ts     # カタログ管理
├── dna/route.ts         # スタイルDNA
├── ops/route.ts         # 運用管理
└── ...
```

#### 3.2.2 Express サーバー (開発用)

```typescript
// server/index.ts
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// SSE エンドポイント
app.get('/api/generation-stream/:taskId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // ...
});
```

#### 3.2.3 CLIP Embedding Server (Python)

```python
# server/clip-server.py
from flask import Flask, request, jsonify
from PIL import Image
import torch
import clip

app = Flask(__name__)
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

@app.route('/encode-image', methods=['POST'])
def encode_image():
    # 画像からembeddingを生成
    image = Image.open(request.files['image'])
    image_input = preprocess(image).unsqueeze(0).to(device)

    with torch.no_grad():
        image_features = model.encode_image(image_input)

    return jsonify({
        'embedding': image_features.cpu().numpy().tolist()[0]
    })
```

### 3.3 データベース

#### 3.3.1 Supabase構成

- **PostgreSQL**: バージョン 15.x
- **拡張機能**:
  - `uuid-ossp`: UUID生成
  - `pgvector`: ベクトル類似度検索
  - `pg_trgm`: 全文検索
- **認証**: Supabase Auth (JWT)
- **Row Level Security**: 全テーブルで有効化

### 3.4 外部サービス

#### 3.4.1 AI サービス

| サービス | 用途 | エンドポイント |
|---------|------|--------------|
| DeepSeek AI | プロンプト生成 | `https://api.deepseek.com/v1/chat/completions` |
| ImagineAPI | 画像生成 | `https://api.imagineapi.dev/v1/generations` |
| CLIP (自前) | embedding生成 | `http://localhost:5001` |

#### 3.4.2 ストレージ

| サービス | 用途 | プロトコル |
|---------|------|----------|
| Cloudflare R2 | 画像保存 | S3互換API |
| Vercel Blob | 一時ファイル | Vercel SDK |

---

## 4. 機能仕様

### 4.1 CREATEモード（画像生成システム）

#### 4.1.0 概要と背景

**目的**: 誰でも"デザイナー"として生成・公開・売買できる体験を、**美しいビジュアル（Urula）と洗練されたUI**で提供する。

**メイン機能**: **FUSION（画像×画像）**をデフォルトCREATEモードとし、Settings経由で他の6モードに切り替え可能。

**サポートされるモード:**
1. **FUSION** (デフォルト): 2つの画像を合成してデザイン生成
2. **COMPOSER**: 5つの質問に答えて段階的にデザイン作成
3. **FREESTYLE**: 自由なテキスト入力でデザイン生成
4. **REMIX**: 既存アセットを再解析して方向性を調整
5. **EVENT**: イベントブリーフに沿った投稿
6. **PALETTE**: 環境色からインスピレーションを得たデザイン
7. **VOICE**: 音声入力 → STT → 意図解釈 → デザイン生成

#### 4.1.1 FUSION モード（メイン）

**コンセプト**: 2つの画像を選択・分析・ブレンドして新しいデザインを生成

**UIフロー:**
1. **SELECT SOURCES**: 画像2枚（アップロード/撮影）を選択
2. **ANALYZE**: Gemini Visionで**色彩・素材・柄・形状特徴**を可視化
3. **BLEND RATIO**: A/Bスライダー（合計100、初期値50/50）
4. **REVIEW**: 要約＋Urula反映 → **GENERATE**ボタン
5. **REVEAL**: 待望のガラスストライプシャッター演出
6. **PUBLISH**: タイトル/カテゴリ/説明/タグ/価格 → `published_items`へ保存

**API:**
```typescript
// 1) 画像分析
POST /api/fusion/analyze
{
  imgA: string;      // base64 dataURL
  imgB: string;      // base64 dataURL
  userId?: string;
}
→ {
  tagsA: { colors: string[], materials: string[], patterns: string[], shapes: string[] };
  tagsB: { colors: string[], materials: string[], patterns: string[], shapes: string[] };
  captions: { A: string, B: string };
}

// 2) プロンプト合成
POST /api/fusion/compose
{
  tagsA: TagSet;
  tagsB: TagSet;
  ratio: { A: number, B: number };  // 0-100
  dna: UrulaState;
  freeText?: string;
}
→ {
  prompt: string;
  negative: string;
  meta: object;
}
```

**合成ルール（詳細）:**
- **色**: 上位5色 → base/main/accentに頻度割当（ratioで重み付け）
- **素材・柄**: 頻度加重で出現確率↑（Pinstripe/GlassRib/Denim/Leather/Canvas）
- **形**: 丸形/角形、ボリューム傾向 → `shape_bias`に加算（±0.1~0.3）
- **NEGATIVE**: 人物/ロゴ/著名人/テキスト/透かし
- **Gemini Guidance（任意）**: 自由文 → 直観的チップ → 絞り込みプロンプト反映

**Urula反映:**
- **色**: 抽出色の**weighted mix**
- **形**: 自然 → **揺らぎ↑**、工業/広告 → **揺らぎ↓**
- **質感**: 素材依存に応じ、`albedo ×0.12~0.2`, `normal ×0.2~0.3`で微妙ブレンド

#### 4.1.2 COMPOSER モード

**コンセプト**: 設問強制型。5つの質問に答えてデザインを段階的に構築。

**フロー:**
1. 5つの質問（Vibe/Silhouette/Season/Color/Material）に回答
2. Guidance API呼び出し（タグ生成）
3. REVIEW → GENERATE → REVEAL → PUBLISH

**対応パラメータ（従来仕様を継承）:**
- **雰囲気 (Vibe)**: カジュアル、エレガント、ボヘミアン、モダン、ミニマル、ヴィンテージ、スポーティ、クラシック、アーバン、ロマンティック、エクレクティック、ミリタリー
- **シルエット**: Aライン、オーバーサイズ、タイトフィット、ストレート、フレア、コクーン、ペンシル、シフト、エンパイア
- **カラーパレット**: ナチュラル、ビビッド、パステル、モノクロ、アースカラー、ネオン、メタリック、ニュートラル
- **生地**: コットン、シルク、ウール、デニム、レザー、リネン、サテン、ベルベット

#### 4.1.3 FREESTYLE モード

**コンセプト**: 自由テキスト入力

**フロー:**
1. ユーザーが自然言語でデザインイメージを入力
2. **INTERPRET** (Guidance API) でタグ抽出
3. REVIEW → GENERATE → REVEAL → PUBLISH

**API:**
```typescript
POST /api/guidance/interpret
{
  freeText: string;
  currentDNA: UrulaState;
}
→ {
  tags: string[];
  dnaDelta: Partial<UrulaState>;
  warnings: string[];
}
```

#### 4.1.4 REMIX モード

**コンセプト**: 既存画像を再解析し、方向性スライダーで調整

**フロー:**
1. 既存Asset選択 → DNA抽出
2. 方向性スライダー（例: よりカジュアル ← → よりフォーマル）
3. GENERATE → REVEAL → PUBLISH

#### 4.1.5 EVENT モード

**コンセプト**: イベントBrief（テーマ/必須タグ/禁止タグ）に沿った投稿

**DBスキーマ（追加）:**
```sql
CREATE TABLE event_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  required_tags TEXT[] DEFAULT '{}',
  banned_tags TEXT[] DEFAULT '{}',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES event_briefs(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES generation_history(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'submitted', -- submitted/shortlist/winner
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**フロー:**
1. イベント選択 → Brief表示
2. 各モード起動 → 最後に`event_id`紐付けて提出

#### 4.1.6 PALETTE モード

**コンセプト**: 環境色（画像1枚）→ 5色抽出 → 希望割合配分 → 生成

**フロー:**
1. 画像1枚選択
2. 5色抽出（Gemini Vision or CLIP）
3. 各色の希望割合を割当
4. GENERATE → REVEAL → PUBLISH

#### 4.1.7 VOICE モード

**コンセプト**: 音声入力 → 意図解釈 → 生成

**フロー:**
1. ボイスレコーディング
2. STT（Speech-to-Text）
3. Guidance API → タグ抽出
4. REVIEW → GENERATE → REVEAL → PUBLISH

**全モード共通のフロー:**
```
ANSWERING/SELECT → COACHING(optional) → REVIEW → GENERATING → REVEAL → PUBLISH
```

- **Realtime**: `generation_history`の`r2_url`受信 → Revealへ遷移
- **Fallback**: 指数ポーリング（5s→10s→20s、最大20分）

### 4.2 高度な検索機能

#### 4.2.1 マルチモーダル検索

**検索対象:**
- テキスト検索 (タイトル、説明、タグ)
- 画像検索 (CLIP embedding類似度)
- カラー検索 (dominant color)
- 価格範囲検索

**実装例:**
```typescript
// API: /api/search
interface SearchRequest {
  query?: string;          // テキスト検索
  image?: File;            // 画像検索
  tags?: string[];         // タグフィルタ
  colors?: string[];       // カラーフィルタ
  priceMin?: number;       // 価格下限
  priceMax?: number;       // 価格上限
  sort?: 'relevance' | 'likes' | 'views' | 'date';
  limit?: number;
  offset?: number;
}
```

**pgvector検索クエリ:**
```sql
SELECT
  id, title, image_url, tags, colors, price, likes, views,
  1 - (embedding <=> $1::vector) as similarity
FROM published_items
WHERE
  ($2::text[] IS NULL OR tags && $2::text[])
  AND ($3::text[] IS NULL OR colors && $3::text[])
  AND ($4::numeric IS NULL OR price >= $4)
  AND ($5::numeric IS NULL OR price <= $5)
ORDER BY embedding <=> $1::vector
LIMIT $6 OFFSET $7;
```

#### 4.2.2 検索候補・自動補完

人気タグに基づく自動補完機能:

```typescript
const getSuggestions = async (prefix: string): Promise<string[]> => {
  const { data } = await supabase.rpc('get_popular_tags', {
    prefix_query: prefix,
    limit_count: 10
  });
  return data;
};
```

### 4.3 Urula（メタボール）仕様

#### 4.3.0 概要

**Urula**は、ユーザー個別の視覚的嗜好を表現する3D **メタボール**システムです。生成履歴に基づいてパーソナライズされた形状・色彩・質感を持ち、全CREATEステージでインタラクティブに表示されます。

#### 4.3.1 コンポーネント

**主要コンポーネント:**
- `MetaballsSoft.tsx`: MarchingCubesベース（resolution=64, maxPolyCount=20000）
- `GlassRevealCanvas.tsx`: ガラスストライプ演出シャッター（REVEAL時）

#### 4.3.2 テクスチャ（用意済みアセット）

**Albedo（ベースカラー）:**
- `Canvas_albedo.webp`
- `Denim_albedo.webp`
- `Leather_albedo.webp`
- `Pinstripe_albedo.webp`
- `Glassribpattern_albedo.webp`

**Normal（法線マップ）:**
- `Canvas_nomal.png`
- `Denim_nomal.png`
- `Leather_nomal.png`
- `Pinstripe_nomal.png`
- `Glassribpattern_nomal.png`

**読み込み設定:**
- RepeatWrapping / LinearFilter
- sRGB (albedo), linear (normal)

#### 4.3.3 質感ブレンド

**Shader設定:**
```glsl
// Albedo
albedo = mix(baseColor, texColor, texture_level);  // 0.12~0.20

// Normal
normal = normalBlend(nBase, nTex, texture_level * 1.2);  // 0.2~0.3
```

- **texture_level**: `user_urula_state.texture_level`で調整（0..1）

#### 4.3.4 インタラクション（全ステージで有効）

**Tap**: 小パルス（透明度/盈虚速く +）、`texture_level ±0.02` (0..1 clamp)

**Swipe**: Urulaを回転（カメラ固定）
```typescript
rotation.y += deltaX * 0.005;
rotation.x += deltaY * 0.005;
```

#### 4.3.5 個性・蓄積

**DBスキーマ:**
```sql
CREATE TABLE user_urula_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 色ヒストグラム・素材傾向・形傾向（累積平均）
  color_hist JSONB,       -- { red:0.18, green:0.33, ... } 0..1
  material_bias JSONB,    -- { denim:0.12, leather:0.25, pinstripe:0.09, canvas:0.05, glassrib:0.03 }
  shape_bias JSONB,       -- { oversized_fitted: -0.2, relaxed_tailored: 0.3, soft_sharp:-0.1 }
  texture_level FLOAT DEFAULT 0.25,  -- 質感ブレンド強度 0..1
  wobble FLOAT DEFAULT 0.5            -- 揺らぎ 0..1
);
```

**蓄積ロジック:**
- 生成完了時に`generation_history.answers/dna`を`user_urula_state`へ**指数移動平均**で反映:
  - `material_bias`: 今回の素材タグに +0.05~0.15
  - `color_hist`: 抽出3色を +
  - `shape_bias`: オーバーサイズ/テーラード/ソフト/シャープ等を ±
- 毎回表示時は**保存値**を初期値に使う（ユーザー固有のUrulaに近づく）

#### 4.3.6 API

```typescript
// Urula状態取得（初期表示用）
GET /api/urula/state?userId={userId}
→ { color_hist, material_bias, shape_bias, texture_level, wobble }

// 生成完了で蓄積更新
POST /api/urula/apply
{
  userId: string;
  generationId: string;
}
→ { updated: true }
```

### 4.4 分析・インサイト機能

#### 4.4.1 個人ダッシュボード

**表示データ:**
- 総生成数 / 公開アイテム数
- 総いいね数 / 総ビュー数
- 日別生成数グラフ (過去30日)
- よく使うパラメータ分析
- 個人スタイルトレンド

**API実装:**
```typescript
// GET /api/analytics?userId={userId}
interface AnalyticsResponse {
  overview: {
    totalGenerations: number;
    publishedItems: number;
    totalLikes: number;
    totalViews: number;
  };
  dailyGenerations: Array<{
    date: string;
    count: number;
  }>;
  topParameters: {
    vibe: Record<string, number>;
    silhouette: Record<string, number>;
    palette: Record<string, number>;
  };
  styleTrend: {
    personal: Record<string, number>;
    overall: Record<string, number>;
  };
}
```

#### 4.4.2 マーケットプレイス分析

- カテゴリ別パフォーマンス
- 価格帯別売上分析
- エンゲージメント率
- 時間帯別アクセス分析

### 4.5 レコメンデーション

#### 4.5.1 パーソナライズド推薦

ユーザーの生成履歴とインタラクション履歴に基づく推薦:

```sql
-- 類似スタイル推薦
SELECT pi.*
FROM published_items pi
JOIN generation_history gh ON true
WHERE gh.user_id = $1
  AND pi.user_id != $1
ORDER BY (
  -- タグ類似度
  CARDINALITY(pi.tags & gh.tags::text[]) * 0.4 +
  -- カラー類似度
  CARDINALITY(pi.colors & gh.colors::text[]) * 0.3 +
  -- embedding類似度
  (1 - (pi.embedding <=> gh.embedding)) * 0.3
) DESC
LIMIT 20;
```

#### 4.5.2 トレンド推薦

直近7日間で人気のアイテム:

```sql
SELECT *
FROM published_items
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY (likes * 0.7 + views * 0.3) DESC
LIMIT 20;
```

### 4.6 エクスポート機能

#### 4.6.1 高解像度エクスポート

**品質設定:**
- Ultra: 4096x4096, 100% quality
- High: 2048x2048, 90% quality
- Medium: 1024x1024, 80% quality
- Low: 512x512, 70% quality

**対応形式:**
- PNG (ロスレス)
- JPEG (高圧縮)
- WebP (次世代フォーマット)

**実装:**
```typescript
// API: /api/export
import sharp from 'sharp';

const exportImage = async (imageUrl: string, quality: string, format: string) => {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();

  const dimensions = QUALITY_MAP[quality];

  const processed = await sharp(Buffer.from(buffer))
    .resize(dimensions.width, dimensions.height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFormat(format, {
      quality: dimensions.quality
    })
    .toBuffer();

  return processed;
};
```

#### 4.6.2 バッチエクスポート

最大10アイテムを一括ダウンロード (ZIP形式):

```typescript
import archiver from 'archiver';

const batchExport = async (imageIds: string[]) => {
  const archive = archiver('zip', { zlib: { level: 9 } });

  for (const id of imageIds) {
    const buffer = await exportImage(id, 'high', 'png');
    archive.append(buffer, { name: `${id}.png` });
  }

  archive.finalize();
  return archive;
};
```

### 4.6 SNSシェア機能

#### 4.6.1 対応プラットフォーム

| プラットフォーム | URL形式 | パラメータ |
|---------------|---------|-----------|
| Twitter | `https://twitter.com/intent/tweet` | `text`, `url`, `hashtags` |
| Instagram | ストーリー共有API | `image`, `caption` |
| Pinterest | `https://pinterest.com/pin/create/button/` | `media`, `description` |
| Facebook | `https://www.facebook.com/sharer/sharer.php` | `u` (URL) |
| LINE | `https://line.me/R/msg/text/` | メッセージ |

**実装例:**
```typescript
const shareToTwitter = (item: Asset) => {
  const text = `${item.title} - Open Wardrobe Market`;
  const hashtags = item.tags.slice(0, 3).join(',');
  const url = `${APP_URL}/items/${item.id}`;

  const shareUrl = new URL('https://twitter.com/intent/tweet');
  shareUrl.searchParams.set('text', text);
  shareUrl.searchParams.set('url', url);
  shareUrl.searchParams.set('hashtags', hashtags);

  window.open(shareUrl.toString(), '_blank');
};
```

---

## 5. データベース設計

### 5.1 テーブル定義

#### 5.1.1 generation_history (生成履歴)

```sql
CREATE TABLE generation_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- プロンプト情報
  user_prompt text,
  optimized_prompt text,
  prompt text,              -- 最終合成プロンプト（新規）
  negative text,            -- ネガティブプロンプト（新規）

  -- 生成パラメータ
  parameters jsonb DEFAULT '{}',  -- vibe, silhouette, palette等
  answers jsonb,            -- モード固有の入力（FUSION: tags/ratio等）（新規）
  dna jsonb,                -- Urula嗜好反映（新規）
  chip_tags jsonb,          -- Guidanceの直観的タグ（新規）

  -- ImagineAPI情報
  task_id text UNIQUE,
  imagine_status text DEFAULT 'pending',  -- pending/processing/completed/failed
  completion_status text DEFAULT 'pending',  -- pending/completed/failed（新規）

  -- 生成結果
  image_key text,  -- R2 key (新: r2_key)
  image_url text,  -- R2 URL (新: r2_url)
  raw_url text,    -- 元画像URL
  final_url text,  -- 最終画像URL
  r2_key text,     -- R2内キー（画像）（明示的追加）
  r2_url text,     -- 公開URL or 署名URL（明示的追加）

  -- メタデータ
  width integer,
  height integer,
  aspect_ratio text DEFAULT '3:4',
  source_mode text DEFAULT 'fusion',  -- 'composer'|'freestyle'|'remix'|'event'|'palette'|'voice'（新規）

  -- embedding (pgvector)
  embedding vector(512),

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- インデックス
CREATE INDEX idx_generation_user_id ON generation_history(user_id);
CREATE INDEX idx_generation_task_id ON generation_history(task_id);
CREATE INDEX idx_generation_created_at ON generation_history(created_at DESC);
CREATE INDEX idx_generation_source_mode ON generation_history(source_mode);
CREATE INDEX idx_generation_embedding ON generation_history USING ivfflat (embedding vector_cosine_ops);

-- RLS
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generations"
  ON generation_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generations"
  ON generation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 5.1.2 published_items (公開アイテム)

```sql
CREATE TABLE published_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  gen_id uuid REFERENCES generation_history(id) ON DELETE CASCADE,  -- 生成履歴参照（新規）
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基本情報
  title text NOT NULL,
  description text,
  category text,  -- 'user-generated' or 'catalog'

  -- 画像情報
  image_id uuid,
  image_url text NOT NULL,
  image_key text,

  -- メタデータ
  tags text[] DEFAULT '{}',
  colors text[] DEFAULT '{}',
  auto_tags text[] DEFAULT '{}',  -- AI生成タグ
  ai_description text,

  -- デザインパラメータ
  metadata jsonb DEFAULT '{}',
  generation_data jsonb,

  -- ポスター情報
  poster_template text,  -- 使用したテンプレート
  poster_title text,
  poster_description text,

  -- マーケット情報
  price numeric(10, 2) DEFAULT 0,
  is_active boolean DEFAULT true,
  is_public boolean DEFAULT true,
  status text DEFAULT 'active',

  -- エンゲージメント
  likes integer DEFAULT 0,
  views integer DEFAULT 0,

  -- embedding
  embedding vector(512),

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX idx_published_user_id ON published_items(user_id);
CREATE INDEX idx_published_category ON published_items(category);
CREATE INDEX idx_published_likes ON published_items(likes DESC);
CREATE INDEX idx_published_views ON published_items(views DESC);
CREATE INDEX idx_published_created_at ON published_items(created_at DESC);
CREATE INDEX idx_published_tags ON published_items USING GIN(tags);
CREATE INDEX idx_published_colors ON published_items USING GIN(colors);
CREATE INDEX idx_published_embedding ON published_items USING ivfflat (embedding vector_cosine_ops);

-- RLS
ALTER TABLE published_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public items"
  ON published_items FOR SELECT
  USING (is_public = true AND is_active = true);

CREATE POLICY "Users can view own items"
  ON published_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own items"
  ON published_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON published_items FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 5.1.3 likes (いいね)

```sql
CREATE TABLE likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES published_items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id, item_id)
);

CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_item_id ON likes(item_id);

-- RLS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own likes"
  ON likes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);
```

#### 5.1.4 user_urula_state (Urula嗜好状態)

```sql
CREATE TABLE user_urula_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),

  -- 色ヒストグラム・素材傾向・形傾向（累積平均）
  color_hist jsonb,       -- { red:0.18, green:0.33, ... } 0..1
  material_bias jsonb,    -- { denim:0.12, leather:0.25, pinstripe:0.09, canvas:0.05, glassrib:0.03 }
  shape_bias jsonb,       -- { oversized_fitted: -0.2, relaxed_tailored: 0.3, soft_sharp:-0.1 }
  texture_level float DEFAULT 0.25,  -- 質感ブレンド強度 0..1
  wobble float DEFAULT 0.5            -- 揺らぎ 0..1
);

-- RLS
ALTER TABLE user_urula_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own urula state"
  ON user_urula_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own urula state"
  ON user_urula_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own urula state"
  ON user_urula_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 5.1.5 event_briefs (イベント募集)

```sql
CREATE TABLE event_briefs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  body text NOT NULL,
  required_tags text[] DEFAULT '{}',
  banned_tags text[] DEFAULT '{}',
  start_at timestamptz,
  end_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_event_start_at ON event_briefs(start_at DESC);
CREATE INDEX idx_event_end_at ON event_briefs(end_at);

-- RLS
ALTER TABLE event_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events"
  ON event_briefs FOR SELECT
  USING (start_at <= now() AND (end_at IS NULL OR end_at >= now()));
```

#### 5.1.6 event_submissions (イベント投稿)

```sql
CREATE TABLE event_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid REFERENCES event_briefs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES generation_history(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'submitted', -- submitted/shortlist/winner
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_event_submissions_event_id ON event_submissions(event_id);
CREATE INDEX idx_event_submissions_user_id ON event_submissions(user_id);
CREATE INDEX idx_event_submissions_status ON event_submissions(status);

-- RLS
ALTER TABLE event_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event submissions"
  ON event_submissions FOR SELECT
  USING (true);

CREATE POLICY "Users can create own submissions"
  ON event_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 5.1.7 user_profiles (ユーザープロファイル)

```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基本情報
  display_name text,
  bio text,
  avatar_url text,
  website text,

  -- ソーシャルリンク
  twitter text,
  instagram text,

  -- 設定
  is_public boolean DEFAULT true,
  email_notifications boolean DEFAULT true,

  -- 統計
  total_generations integer DEFAULT 0,
  total_published integer DEFAULT 0,
  total_likes_received integer DEFAULT 0,

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public profiles"
  ON user_profiles FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);
```

#### 5.1.5 dna_catalog (スタイルDNA)

```sql
CREATE TABLE dna_catalog (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- DNA情報
  dna_string text UNIQUE NOT NULL,  -- 8桁DNA文字列
  label text,
  description text,

  -- デザインパラメータ
  parameters jsonb DEFAULT '{}',

  -- カタログ画像
  images jsonb DEFAULT '[]',  -- [{url, r2_key, order}]

  -- メタデータ
  tags text[] DEFAULT '{}',
  colors text[] DEFAULT '{}',

  -- 統計
  generation_count integer DEFAULT 0,
  like_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dna_string ON dna_catalog(dna_string);
CREATE INDEX idx_dna_tags ON dna_catalog USING GIN(tags);
```

### 5.2 マテリアライズドビュー

#### 5.2.1 user_analytics_summary

```sql
CREATE MATERIALIZED VIEW user_analytics_summary AS
SELECT
  user_id,
  COUNT(DISTINCT gh.id) as total_generations,
  COUNT(DISTINCT pi.id) as total_published,
  COALESCE(SUM(pi.likes), 0) as total_likes,
  COALESCE(SUM(pi.views), 0) as total_views,

  -- 過去30日の統計
  COUNT(DISTINCT CASE
    WHEN gh.created_at >= NOW() - INTERVAL '30 days'
    THEN gh.id
  END) as recent_generations,

  -- よく使うパラメータ
  jsonb_object_agg(
    COALESCE(gh.parameters->>'vibe', 'unknown'),
    COUNT(*)
  ) FILTER (WHERE gh.parameters->>'vibe' IS NOT NULL) as vibe_distribution

FROM auth.users u
LEFT JOIN generation_history gh ON u.id = gh.user_id
LEFT JOIN published_items pi ON u.id = pi.user_id
GROUP BY user_id;

-- リフレッシュ関数
CREATE OR REPLACE FUNCTION refresh_user_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_analytics_summary;
END;
$$ LANGUAGE plpgsql;
```

### 5.3 データベース関数

#### 5.3.1 ベクトル検索関数

```sql
CREATE OR REPLACE FUNCTION search_similar_items(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.id,
    pi.title,
    pi.image_url,
    1 - (pi.embedding <=> query_embedding) as similarity
  FROM published_items pi
  WHERE
    pi.is_public = true
    AND pi.is_active = true
    AND 1 - (pi.embedding <=> query_embedding) > match_threshold
  ORDER BY pi.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

#### 5.3.2 いいね処理トリガー

```sql
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE published_items
    SET likes = likes + 1
    WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE published_items
    SET likes = likes - 1
    WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_likes_count();
```

---

## 6. API仕様

### 6.1 認証API

#### 6.1.1 サインアップ

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

#### 6.1.2 ログイン

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "user": { ... },
  "session": { ... }
}
```

### 6.2 CREATEモードAPI

#### 6.2.1 FUSION - 画像分析

```http
POST /api/fusion/analyze
Authorization: Bearer {token}
Content-Type: application/json

{
  "imgA": "data:image/png;base64,...",
  "imgB": "data:image/png;base64,...",
  "userId": "uuid"
}

# Response
{
  "tagsA": {
    "colors": ["navy", "white", "gray"],
    "materials": ["denim", "cotton"],
    "patterns": ["solid", "pinstripe"],
    "shapes": ["oversized", "relaxed"]
  },
  "tagsB": {
    "colors": ["black", "leather"],
    "materials": ["leather", "canvas"],
    "patterns": ["solid"],
    "shapes": ["fitted", "sharp"]
  },
  "captions": {
    "A": "Casual denim jacket with relaxed fit",
    "B": "Fitted black leather jacket"
  }
}
```

#### 6.2.2 FUSION - プロンプト合成

```http
POST /api/fusion/compose
Authorization: Bearer {token}
Content-Type: application/json

{
  "tagsA": { ... },
  "tagsB": { ... },
  "ratio": { "A": 60, "B": 40 },
  "dna": {
    "color_hist": { ... },
    "material_bias": { ... },
    "shape_bias": { ... },
    "texture_level": 0.25,
    "wobble": 0.5
  },
  "freeText": "よりエレガントに"
}

# Response
{
  "prompt": "[SHOT] Full-body fashion studio shot...\n[ROLE-COLORS] Dominant navy (~60%), secondary black (~30%), accent white (~10%)\n[SUBJECT] adult contemporary jacket for spring/fall, elegant-casual\n[FABRICS/PATTERNS] denim-leather blend with subtle pinstripe hints\n[SILHOUETTE] semi-fitted, relaxed elegance\n[SAFETY] no logos, no text, no celebrities, no watermarks, single model, high detail",
  "negative": "logo, brand mark, celebrity, watermark, text, caption, distortion, blur",
  "meta": {
    "dominantColor": "navy",
    "primaryMaterial": "denim-leather",
    "vibe": "elegant-casual"
  }
}
```

#### 6.2.3 Guidance - 自由文解釈

```http
POST /api/guidance/interpret
Authorization: Bearer {token}
Content-Type: application/json

{
  "freeText": "夏のビーチに合うリラックスした服",
  "currentDNA": { ... }
}

# Response
{
  "tags": ["beach", "summer", "relaxed", "linen", "white", "blue", "airy"],
  "dnaDelta": {
    "color_hist": { "white": 0.4, "blue": 0.3 },
    "material_bias": { "linen": 0.3, "cotton": 0.2 },
    "shape_bias": { "relaxed": 0.2 }
  },
  "warnings": []
}
```

#### 6.2.4 Urula状態管理

```http
# 状態取得
GET /api/urula/state?userId={userId}
Authorization: Bearer {token}

# Response
{
  "color_hist": { "red": 0.18, "green": 0.33, "blue": 0.25 },
  "material_bias": { "denim": 0.12, "leather": 0.25, "pinstripe": 0.09 },
  "shape_bias": { "oversized_fitted": -0.2, "relaxed_tailored": 0.3 },
  "texture_level": 0.25,
  "wobble": 0.5
}

# 蓄積更新
POST /api/urula/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "uuid",
  "generationId": "uuid"
}

# Response
{
  "updated": true,
  "newState": { ... }
}
```

### 6.3 デザイン生成API

#### 6.3.1 チャットベース生成（従来方式）

```http
POST /api/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "カジュアルなサマードレスを作りたい",
  "conversationHistory": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "parameters": {
    "vibe": "casual",
    "palette": "pastel",
    "silhouette": "aline"
  }
}

# Response
{
  "response": "かしこまりました。カジュアルなサマードレスを生成します...",
  "shouldGenerate": true,
  "optimizedPrompt": "A casual summer dress with pastel colors...",
  "parameters": { ... }
}
```

#### 6.3.2 画像生成開始

```http
POST /api/nano-generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "prompt": "A casual summer dress...",
  "parameters": {
    "aspect_ratio": "3:4",
    "style": "photographic"
  },
  "userId": "uuid"
}

# Response
{
  "taskId": "task_uuid",
  "status": "pending",
  "estimatedTime": 30
}
```

#### 6.2.3 生成ステータス (SSE)

```http
GET /api/generation-stream/{taskId}
Authorization: Bearer {token}

# SSE Stream
event: status
data: {"status": "processing", "progress": 45}

event: complete
data: {"status": "completed", "imageUrl": "https://...", "taskId": "..."}
```

### 6.3 検索API

#### 6.3.1 テキスト検索

```http
GET /api/search?q=summer+dress&tags=casual,elegant&limit=20&offset=0
Authorization: Bearer {token}

# Response
{
  "items": [
    {
      "id": "uuid",
      "title": "Summer Dress",
      "image_url": "https://...",
      "tags": ["casual", "summer"],
      "colors": ["#FF5733", "#C70039"],
      "likes": 42,
      "views": 128,
      "similarity": 0.89
    }
  ],
  "total": 156,
  "limit": 20,
  "offset": 0
}
```

#### 6.3.2 画像検索

```http
POST /api/search
Authorization: Bearer {token}
Content-Type: multipart/form-data

image: [binary]
limit: 20

# Response
{
  "items": [ ... ],
  "total": 87
}
```

### 6.4 分析API

#### 6.4.1 個人分析

```http
GET /api/analytics?userId={userId}&period=30d
Authorization: Bearer {token}

# Response
{
  "overview": {
    "totalGenerations": 42,
    "publishedItems": 15,
    "totalLikes": 328,
    "totalViews": 1247
  },
  "dailyGenerations": [
    {"date": "2025-11-01", "count": 3},
    {"date": "2025-11-02", "count": 5}
  ],
  "topParameters": {
    "vibe": {"casual": 12, "elegant": 8},
    "silhouette": {"aline": 10, "oversize": 5}
  },
  "styleTrend": {
    "personal": {"casual": 0.35, "elegant": 0.25},
    "overall": {"casual": 0.42, "elegant": 0.18}
  }
}
```

### 6.5 レコメンデーションAPI

#### 6.5.1 パーソナライズド推薦

```http
GET /api/recommend?type=personalized&limit=20
Authorization: Bearer {token}

# Response
{
  "recommendations": [
    {
      "id": "uuid",
      "title": "...",
      "image_url": "...",
      "reason": "Similar to your recent designs",
      "score": 0.92
    }
  ]
}
```

#### 6.5.2 トレンド推薦

```http
GET /api/recommend?type=trending&period=7d&limit=20

# Response
{
  "recommendations": [ ... ]
}
```

### 6.6 エクスポートAPI

#### 6.6.1 単一エクスポート

```http
POST /api/export
Authorization: Bearer {token}
Content-Type: application/json

{
  "imageId": "uuid",
  "quality": "high",  // ultra/high/medium/low
  "format": "png"     // png/jpeg/webp
}

# Response (Binary)
Content-Type: image/png
Content-Disposition: attachment; filename="design_12345.png"
[binary data]
```

#### 6.6.2 バッチエクスポート

```http
POST /api/export/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "imageIds": ["uuid1", "uuid2", "uuid3"],
  "quality": "high",
  "format": "png"
}

# Response (Binary)
Content-Type: application/zip
Content-Disposition: attachment; filename="designs.zip"
[binary data]
```

### 6.7 インタラクションAPI

#### 6.7.1 いいね

```http
POST /api/likes
Authorization: Bearer {token}
Content-Type: application/json

{
  "itemId": "uuid"
}

# Response
{
  "success": true,
  "liked": true,
  "totalLikes": 43
}
```

#### 6.7.2 いいね解除

```http
DELETE /api/likes/{itemId}
Authorization: Bearer {token}

# Response
{
  "success": true,
  "liked": false,
  "totalLikes": 42
}
```

---

## 6.6 プロンプト合成テンプレート（共通）

### 6.6.1 基本テンプレート構造

**全モード共通のプロンプト生成テンプレート:**

```
[SHOT] Full-body fashion studio shot, clean minimal background, 35mm, soft box
[ROLE-COLORS] Dominant {base} (~65%), secondary {main} (~30%), accent {accent} (~5%)
[SUBJECT] {gender}/{age} {key_items} for {season}, {taste_tags}
[FABRICS/PATTERNS] {fabrics} with {patterns} hints, subtle rib/glass where relevant
[SILHOUETTE] {silhouette_tags}, {oversized_fitted}, {relaxed_tailored}
[ERA/REF] {era?}
[GUIDANCE] {chips...}
[SAFETY] no logos, no text, no celebrities, no watermarks, single model, high detail
--width 960 --height 1280
```

### 6.6.2 優先順位階層

1. **既存テンプレ** → 必須入力/抽出
2. **DNA成分（進捗）** → Guidance chipス（追加）
3. **自由文（追加）**

### 6.6.3 合成ルール詳細

**色 (Colors):**
- 上位5色 → **base/main/accent**に頻度割当（ratioで重み付け）
- 例: Navy 60% + Black 40% → Dominant navy (~65%), secondary black (~30%), accent white (~5%)

**素材・柄 (Fabrics/Patterns):**
- 頻度加重で出現確率↑
- サポート素材: Pinstripe / GlassRib / Denim / Leather / Canvas
- 例: "denim-leather blend with subtle pinstripe hints"

**形 (Silhouette):**
- 丸形/角形、ボリューム傾向 → `shape_bias`に加算（±0.1~0.3）
- 例: "semi-fitted, relaxed elegance"

**NEGATIVE（明示的に除外）:**
```
logo, brand mark, celebrity, watermark, text, caption, distortion, blur, multiple people
```

### 6.6.4 Gemini Guidance統合

**オプション機能:**
1. ユーザーが自由文入力（例: "よりエレガントに"）
2. Gemini が直観的チップタグを生成
3. タグを追加でプロンプト末尾に反映

**例:**
```typescript
// Input
freeText: "夏のビーチに合うリラックスした服"

// Gemini Output
tags: ["beach", "summer", "relaxed", "linen", "white", "blue", "airy"]

// Final Prompt
[GUIDANCE] beach summer relaxed linen white blue airy
```

---

## 6.7 Reveal演出（GlassRevealCanvas）

### 6.7.1 概要

**GlassRevealCanvas**は、生成完了後の画像を**ガラスストライプシャッター**で演出表示するビジュアルエフェクトです。

### 6.7.2 技術仕様

**コンポーネント:** `GlassRevealCanvas.tsx`

**Shaderパラメータ:**
```typescript
u_stripes = 48       // ストライプ本数
u_jitter = 0.08      // ジッター（揺らぎ）
u_edge = 0.12        // エッジ幅
u_strength = 0.9     // エフェクト強度
u_pixels = 80        // ピクセル化粒度
```

**タイムライン（合計5.3秒）:**
```
fadeIn 400ms → hold 3000ms → reveal 1200ms → settle 700ms
```

### 6.7.3 実装詳細

**Fragment Shader重要部分:**
```glsl
// mat.extensions.derivatives = true が必須（dFdx/dFdy利用）

if (u_progress >= 0.999) {
  offset = vec2(0.0);  // 最終フレームで完全ゼロ（波み消去）
}
```

**完全性保証:**
- `u_progress >= 0.999`到達時は`offset=vec2(0)`を**最優先に代入**
- これにより波み残りゼロで完璧な画像表示を保証

### 6.7.4 使用箇所

**全CREATEモード共通:**
- FUSION → REVEAL
- COMPOSER → REVEAL
- FREESTYLE → REVEAL
- REMIX → REVEAL
- EVENT → REVEAL
- PALETTE → REVEAL
- VOICE → REVEAL

---

## 7. フロントエンド実装

### 7.1 プロジェクト構造

```
src/
├── main.tsx                    # エントリーポイント
├── App.tsx                     # ルートコンポーネント
├── MobileApp.tsx               # モバイルアプリ
│
├── app/
│   ├── components/             # 共通コンポーネント
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── GalleryPage.tsx
│   │   ├── PosterCard.tsx
│   │   ├── Icons.tsx
│   │   └── mobile/
│   │       ├── MobileLayout.tsx
│   │       ├── BottomNavigation.tsx
│   │       ├── MenuOverlay.tsx
│   │       ├── MobileGallery.tsx
│   │       └── MobileDetailModal.tsx
│   │
│   ├── pages/                  # ページコンポーネント
│   │   ├── mobile/
│   │   │   ├── MobileHomePage.tsx       # STUDIO (ホーム)
│   │   │   ├── MobileGalleryPage.tsx    # SHOWCASE (ギャラリー)
│   │   │   ├── MobileCreateTopPage.tsx  # CREATE選択
│   │   │   ├── MobileCreatePage.tsx     # CREATE生成
│   │   │   ├── MobileMyPage.tsx         # ARCHIVE (マイページ)
│   │   │   ├── MobilePublishFormPage.tsx
│   │   │   └── MobilePublishCompletePage.tsx
│   │   └── publish/
│   │       └── PublishForm.tsx
│   │
│   ├── lib/                    # ユーティリティ・設定
│   │   ├── AuthContext.tsx     # 認証コンテキスト
│   │   ├── UrulaContext.tsx    # Urulaコンテキスト
│   │   ├── supabase.ts         # Supabaseクライアント
│   │   ├── types.ts            # 型定義
│   │   ├── util.ts             # ユーティリティ関数
│   │   ├── designTokens.ts     # デザイントークン
│   │   ├── posterTemplates.ts  # ポスターテンプレート
│   │   ├── imageUtils.ts       # 画像処理
│   │   ├── vector.ts           # ベクトル操作
│   │   ├── api/
│   │   │   └── assets.ts       # APIクライアント
│   │   ├── utils/
│   │   │   └── detectWebView.ts
│   │   └── vision/
│   │       └── extractStyle.ts
│   │
│   └── styles/                 # スタイル定義
│       └── globals.css
│
└── lib/                        # 共通ライブラリ
    └── urula/
        └── loadTextures.ts     # Urulaテクスチャ読み込み
```

### 7.2 主要コンポーネント

#### 7.2.1 AuthContext (認証管理)

```typescript
// src/app/lib/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初期セッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 認証状態変化を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

#### 7.2.2 MobileCreatePage (デザイン生成)

```typescript
// src/app/pages/mobile/MobileCreatePage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';

interface GenerationParams {
  vibe?: string;
  silhouette?: string;
  palette?: string;
}

export function MobileCreatePage() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [params, setParams] = useState<GenerationParams>({});
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  // SSE接続
  useEffect(() => {
    if (!taskId) return;

    const eventSource = new EventSource(
      `/api/generation-stream/${taskId}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.status === 'completed') {
        setGenerating(false);
        eventSource.close();
        // 完成画像を表示
      }
    };

    return () => eventSource.close();
  }, [taskId]);

  const handleGenerate = async () => {
    setGenerating(true);

    // 1. DeepSeek AIでプロンプト生成
    const promptRes = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, parameters: params })
    });
    const { optimizedPrompt } = await promptRes.json();

    // 2. 画像生成開始
    const generateRes = await fetch('/api/nano-generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: optimizedPrompt,
        parameters: params,
        userId: user?.id
      })
    });
    const { taskId: newTaskId } = await generateRes.json();

    setTaskId(newTaskId);
  };

  return (
    <div>
      {/* UI implementation */}
    </div>
  );
}
```

#### 7.2.3 MobileGalleryPage (ギャラリー)

```typescript
// src/app/pages/mobile/MobileGalleryPage.tsx
import { useState, useEffect } from 'react';
import { Asset } from '../../lib/types';
import { MasonryGallery } from '../../components/mobile/MasonryGallery';

export function MobileGalleryPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchItems();
  }, [searchQuery]);

  const fetchItems = async () => {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`
    );
    const data = await res.json();
    setItems(data.items);
    setLoading(false);
  };

  const handleLike = async (itemId: string) => {
    await fetch('/api/likes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId })
    });

    // UIを更新
    setItems(items.map(item =>
      item.id === itemId
        ? { ...item, liked: true, likes: item.likes + 1 }
        : item
    ));
  };

  return (
    <div>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <MasonryGallery items={items} onLike={handleLike} />
    </div>
  );
}
```

### 7.3 状態管理

#### 7.3.1 Context API使用

```typescript
// グローバル状態管理
- AuthContext: 認証状態
- UrulaContext: Urula設定・テクスチャ
- ThemeContext: テーマ・ダークモード (未実装)
```

#### 7.3.2 ローカル状態管理

```typescript
// useState/useReducer
- フォーム入力
- UI状態 (モーダル、ローディング)
- 一時データ (検索結果、フィルタ)
```

### 7.4 ルーティング

```typescript
// src/MobileApp.tsx
type MobilePage =
  | 'login'
  | 'studio'           // ホーム
  | 'showcase'         // ギャラリー
  | 'create'           // CREATE選択
  | 'createQuestions'  // CREATE生成
  | 'publishForm'      // 公開フォーム
  | 'publishComplete'  // 公開完了
  | 'archive'          // マイページ
  | 'faq'
  | 'contact'
  | 'privacy';

// ブラウザ履歴と同期
const handleNavigate = (page: MobilePage) => {
  setCurrentPage(page);
  window.history.pushState({ page }, '', `/${page}`);
};
```

### 7.5 UI文言規約（タイトル・ラベル）

#### 7.5.1 フォント要件

**全画面ラベル: 英語 ALL CAPS（Trajan固定）**

ページタイトル・主要CTA・ステータス表示は**すべて英語の大文字表記**:

```
HOME / GALLERY / CREATE / MY PAGE / REVIEW / GENERATE / REVEAL / PUBLISH
```

#### 7.5.2 ページタイトル一覧

| 日本語 | 英語表記 (ALL CAPS) |
|-------|-------------------|
| ホーム | HOME |
| ギャラリー | GALLERY |
| 作成 | CREATE |
| マイページ | MY PAGE |
| レビュー | REVIEW |
| 生成中 | GENERATE |
| 公開 | REVEAL |
| 投稿 | PUBLISH |

#### 7.5.3 CTA文言

**メインCTA:**
- **"BEGIN YOUR DESIGN"** - ホーム画面のメインボタン
- **"SELECT TWO IMAGES"** - FUSION開始
- **"ANALYZE"** - 画像分析開始
- **"BLEND & REVIEW"** - ブレンド比率設定
- **"GENERATE"** - 画像生成開始

**ステータス表示:**
- **"PREPARING…"** - 準備中
- **"ANALYZING…"** - 分析中
- **"GENERATING…"** - 生成中
- **"REVEALING…"** - 演出表示中

**完了・成功:**
- **"PUBLISHED TO GALLERY ✓"** - 公開完了

**エラー:**
- **"FAILED TO PUBLISH"** - 公開失敗
- **"GUIDANCE UNAVAILABLE"** - Guidance利用不可
- **"UPLOAD TO R2 FAILED"** - R2アップロード失敗
- **"TITLE REQUIRED"** - タイトル必須
- **"CATEGORY REQUIRED"** - カテゴリ必須

#### 7.5.4 フォント実装

```css
/* Trajanフォント（ALL CAPSラベル用） */
.page-title, .main-cta, .status-text {
  font-family: 'Trajan Pro', 'Trajan', serif;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
}
```

### 7.6 Settings（モード切替）

#### 7.6.1 デフォルトCREATEモード設定

**設定項目:**
```typescript
type CreateMode =
  | 'FUSION'      // デフォルト
  | 'COMPOSER'
  | 'FREESTYLE'
  | 'REMIX'
  | 'EVENT'
  | 'PALETTE'
  | 'VOICE';

interface UserSettings {
  defaultCreateMode: CreateMode;
  enableABTest?: boolean;  // A/Bトグル（将来実験用）
}
```

**保存先:**
- ユーザー単位: `user_settings`テーブル or localStorage
- セッション単位: sessionStorage

#### 7.6.2 A/Bテスト（将来）

**トグル設定例:**
```typescript
// fusion | composer をランダム切り替え
const abTestMode = settings.enableABTest
  ? (Math.random() > 0.5 ? 'FUSION' : 'COMPOSER')
  : settings.defaultCreateMode;
```

---

## 8. バックエンド実装

### 8.1 Next.js API Routes

#### 8.1.1 共通ユーティリティ

```typescript
// app/api/_shared/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 認証ヘルパー
export async function verifyAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}
```

#### 8.1.2 チャットAPI

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../_shared/supabase';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, conversationHistory, parameters } = await request.json();

    // DeepSeek APIリクエスト
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: FASHION_DESIGN_SYSTEM_PROMPT
          },
          ...conversationHistory,
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      })
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // プロンプト最適化ロジック
    const shouldGenerate = aiResponse.includes('[GENERATE]');
    const optimizedPrompt = extractPrompt(aiResponse);

    return NextResponse.json({
      response: aiResponse,
      shouldGenerate,
      optimizedPrompt,
      parameters
    });

  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const FASHION_DESIGN_SYSTEM_PROMPT = `
あなたはファッションデザインアシスタントです。
ユーザーの要望を理解し、最適なデザインプロンプトを生成します。

デザイン生成が必要な場合は、回答に[GENERATE]タグを含めてください。
プロンプトは英語で、詳細に記述してください。

例:
ユーザー: カジュアルなサマードレスが欲しい
回答: かしこまりました。[GENERATE] A casual summer dress with flowing fabric...
`;

function extractPrompt(text: string): string {
  const match = text.match(/\[GENERATE\]\s*(.+)/);
  return match ? match[1].trim() : text;
}
```

#### 8.1.3 画像生成API

```typescript
// app/api/nano-generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase, verifyAuth } from '../_shared/supabase';
import { v4 as uuidv4 } from 'uuid';

const IMAGINE_API_URL = 'https://api.imagineapi.dev/v1/generations';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, parameters } = await request.json();
    const taskId = uuidv4();

    // ImagineAPI リクエスト
    const response = await fetch(IMAGINE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.IMAGINEAPI_BEARER}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        style: parameters.style || 'photographic',
        aspect_ratio: parameters.aspect_ratio || '3:4',
        webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/imagine-webhook`
      })
    });

    const data = await response.json();

    // DBに保存
    await supabase.from('generation_history').insert({
      id: taskId,
      user_id: userId,
      user_prompt: prompt,
      optimized_prompt: prompt,
      parameters,
      task_id: data.id,
      imagine_status: 'pending'
    });

    return NextResponse.json({
      taskId,
      status: 'pending',
      estimatedTime: 30
    });

  } catch (error) {
    console.error('[Generate API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 8.1.4 Webhook受信API

```typescript
// app/api/imagine-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../_shared/supabase';
import { uploadToR2, generateEmbedding } from '../_shared/storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id: taskId, status, result } = body;

    if (status === 'completed') {
      // 画像をR2にアップロード
      const imageUrl = result.url;
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();

      const r2Key = `generations/${taskId}.jpg`;
      const r2Url = await uploadToR2(Buffer.from(imageBuffer), r2Key);

      // CLIP embeddingを生成
      const embedding = await generateEmbedding(imageBuffer);

      // DBを更新
      await supabase
        .from('generation_history')
        .update({
          imagine_status: 'completed',
          image_key: r2Key,
          image_url: r2Url,
          final_url: r2Url,
          embedding,
          completed_at: new Date().toISOString()
        })
        .eq('task_id', taskId);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 8.2 ストレージ処理

#### 8.2.1 Cloudflare R2アップロード

```typescript
// app/api/_shared/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
});

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string = 'image/jpeg'
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
}
```

#### 8.2.2 CLIP Embedding生成

```typescript
// app/api/_shared/storage.ts
export async function generateEmbedding(
  imageBuffer: ArrayBuffer
): Promise<number[]> {
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer]));

  const response = await fetch('http://localhost:5001/encode-image', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  return data.embedding;
}
```

### 8.3 検索処理

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../_shared/supabase';
import { generateEmbedding } from '../_shared/storage';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const tags = searchParams.get('tags')?.split(',');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  let queryBuilder = supabase
    .from('published_items')
    .select('*')
    .eq('is_public', true)
    .eq('is_active', true);

  // テキスト検索
  if (query) {
    queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
  }

  // タグフィルタ
  if (tags && tags.length > 0) {
    queryBuilder = queryBuilder.contains('tags', tags);
  }

  const { data, error, count } = await queryBuilder
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data,
    total: count,
    limit,
    offset
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const limit = parseInt(formData.get('limit') as string || '20');

    // 画像からembedding生成
    const imageBuffer = await image.arrayBuffer();
    const embedding = await generateEmbedding(imageBuffer);

    // ベクトル類似度検索
    const { data, error } = await supabase.rpc('search_similar_items', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: limit
    });

    if (error) throw error;

    return NextResponse.json({ items: data });

  } catch (error) {
    console.error('[Image Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
```

---

## 9. AI統合

### 9.1 DeepSeek AI統合

#### 9.1.1 システムプロンプト設計

```typescript
const FASHION_DESIGN_SYSTEM_PROMPT = `
あなたは世界トップクラスのファッションデザインアシスタントです。
ユーザーの自然言語での要望を理解し、最適な画像生成プロンプトを作成します。

【役割】
1. ユーザーの曖昧な要望を明確化
2. デザインパラメータの提案
3. 高品質な英語プロンプトの生成

【プロンプト生成ルール】
- 具体的な視覚的特徴を記述
- スタイル、カラー、シルエットを明示
- 写実的な表現を使用
- ネガティブプロンプトを避ける

【出力形式】
デザイン生成が必要な場合:
[GENERATE] {英語プロンプト}

質問や確認が必要な場合:
通常の会話で応答

【例】
ユーザー: カジュアルなサマードレスが欲しい
応答: かしこまりました。カジュアルなサマードレスを生成します。
[GENERATE] A casual summer dress with flowing light fabric, pastel yellow color,
A-line silhouette, cotton material, natural lighting, full body view, fashion photography
`;
```

#### 9.1.2 会話履歴管理

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class ConversationManager {
  private messages: Message[] = [];
  private maxMessages = 10;

  addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({ role, content });

    // 最大メッセージ数を超えたら古いものから削除
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  getMessages(): Message[] {
    return [
      { role: 'system', content: FASHION_DESIGN_SYSTEM_PROMPT },
      ...this.messages
    ];
  }

  clear() {
    this.messages = [];
  }
}
```

### 9.2 ImagineAPI統合

#### 9.2.1 生成リクエスト

```typescript
interface ImagineGenerationRequest {
  prompt: string;
  style?: string;
  aspect_ratio?: string;
  cfg_scale?: number;
  steps?: number;
  seed?: number;
  webhook?: string;
}

async function generateWithImagine(
  request: ImagineGenerationRequest
): Promise<{ id: string; status: string }> {
  const response = await fetch('https://api.imagineapi.dev/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.IMAGINEAPI_BEARER}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: request.prompt,
      style: request.style || 'photographic',
      aspect_ratio: request.aspect_ratio || '3:4',
      cfg_scale: request.cfg_scale || 7.5,
      steps: request.steps || 30,
      seed: request.seed,
      webhook: request.webhook
    })
  });

  if (!response.ok) {
    throw new Error(`ImagineAPI error: ${response.status}`);
  }

  return await response.json();
}
```

#### 9.2.2 Webhookハンドリング

```typescript
interface ImagineWebhookPayload {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    url: string;
    width: number;
    height: number;
  };
  error?: string;
}

async function handleImagineWebhook(
  payload: ImagineWebhookPayload
): Promise<void> {
  const { id, status, result, error } = payload;

  if (status === 'completed' && result) {
    // 画像ダウンロード
    const imageResponse = await fetch(result.url);
    const imageBuffer = await imageResponse.arrayBuffer();

    // R2アップロード
    const r2Key = `generations/${id}.jpg`;
    const r2Url = await uploadToR2(Buffer.from(imageBuffer), r2Key);

    // embedding生成
    const embedding = await generateEmbedding(imageBuffer);

    // DB更新
    await supabase
      .from('generation_history')
      .update({
        imagine_status: 'completed',
        image_key: r2Key,
        image_url: r2Url,
        final_url: r2Url,
        width: result.width,
        height: result.height,
        embedding,
        completed_at: new Date().toISOString()
      })
      .eq('task_id', id);

  } else if (status === 'failed') {
    // エラーハンドリング
    await supabase
      .from('generation_history')
      .update({
        imagine_status: 'failed',
        error_message: error
      })
      .eq('task_id', id);
  }
}
```

### 9.3 CLIP Embedding

#### 9.3.1 CLIP Server (Python Flask)

```python
# server/clip-server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch
import clip
import io

app = Flask(__name__)
CORS(app)

# CLIPモデル読み込み
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)
model.eval()

@app.route('/encode-image', methods=['POST'])
def encode_image():
    """画像からembeddingを生成"""
    try:
        # 画像読み込み
        image_file = request.files['image']
        image = Image.open(io.BytesIO(image_file.read())).convert('RGB')

        # 前処理
        image_input = preprocess(image).unsqueeze(0).to(device)

        # embedding生成
        with torch.no_grad():
            image_features = model.encode_image(image_input)
            # L2正規化
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        # NumPy配列に変換
        embedding = image_features.cpu().numpy().tolist()[0]

        return jsonify({
            'embedding': embedding,
            'dimension': len(embedding)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/encode-text', methods=['POST'])
def encode_text():
    """テキストからembeddingを生成"""
    try:
        data = request.json
        text = data.get('text', '')

        # トークン化
        text_input = clip.tokenize([text]).to(device)

        # embedding生成
        with torch.no_grad():
            text_features = model.encode_text(text_input)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        embedding = text_features.cpu().numpy().tolist()[0]

        return jsonify({
            'embedding': embedding,
            'dimension': len(embedding)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/similarity', methods=['POST'])
def calculate_similarity():
    """2つのembedding間の類似度を計算"""
    try:
        data = request.json
        embedding1 = torch.tensor(data['embedding1'])
        embedding2 = torch.tensor(data['embedding2'])

        # コサイン類似度
        similarity = torch.cosine_similarity(
            embedding1.unsqueeze(0),
            embedding2.unsqueeze(0)
        ).item()

        return jsonify({'similarity': similarity})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
```

#### 9.3.2 CLIP Dockerコンテナ

```dockerfile
# server/Dockerfile.clip
FROM python:3.11-slim

WORKDIR /app

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコピー
COPY clip-server.py .

# ポート公開
EXPOSE 5001

# サーバー起動
CMD ["python", "clip-server.py"]
```

```txt
# server/requirements.txt
flask==3.0.0
flask-cors==4.0.0
torch==2.1.0
torchvision==0.16.0
clip @ git+https://github.com/openai/CLIP.git
pillow==10.1.0
```

---

## 10. 認証・セキュリティ

### 10.1 Supabase Auth

#### 10.1.1 認証フロー

```typescript
// サインアップ
const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/callback`
    }
  });

  if (error) throw error;

  // メール確認待ち
  return data;
};

// ログイン
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

// ログアウト
const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// セッション取得
const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// トークンリフレッシュ (自動)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed:', session);
  }
});
```

#### 10.1.2 OAuth連携 (Google)

```typescript
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${APP_URL}/auth/callback`,
      scopes: 'email profile'
    }
  });

  if (error) throw error;
  return data;
};
```

### 10.2 Row Level Security (RLS)

#### 10.2.1 RLSポリシー例

```sql
-- generation_history: 自分の生成履歴のみアクセス可能
CREATE POLICY "Users can access own generations"
  ON generation_history
  FOR ALL
  USING (auth.uid() = user_id);

-- published_items: 公開アイテムは誰でも閲覧可能
CREATE POLICY "Anyone can view public items"
  ON published_items
  FOR SELECT
  USING (is_public = true AND is_active = true);

-- published_items: 自分のアイテムは全操作可能
CREATE POLICY "Users can manage own items"
  ON published_items
  FOR ALL
  USING (auth.uid() = user_id);

-- likes: 自分のいいねのみアクセス可能
CREATE POLICY "Users can manage own likes"
  ON likes
  FOR ALL
  USING (auth.uid() = user_id);
```

### 10.3 APIセキュリティ

#### 10.3.1 認証ミドルウェア

```typescript
// app/api/_shared/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from './supabase';

export async function verifyAuth(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;

  } catch (error) {
    console.error('[Auth] Verification error:', error);
    return null;
  }
}

// 使用例
export async function POST(request: NextRequest) {
  const userId = await verifyAuth(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 処理続行...
}
```

#### 10.3.2 レート制限

```typescript
// app/api/_shared/rateLimit.ts
import { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  request: NextRequest,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();

  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}

// 使用例
export async function POST(request: NextRequest) {
  if (!checkRateLimit(request, 50, 60000)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // 処理続行...
}
```

#### 10.3.3 入力バリデーション

```typescript
// app/api/_shared/validation.ts
import { z } from 'zod';

// 生成リクエストのスキーマ
export const GenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  parameters: z.object({
    vibe: z.string().optional(),
    silhouette: z.string().optional(),
    palette: z.string().optional(),
    aspect_ratio: z.enum(['1:1', '3:4', '4:3', '16:9']).optional()
  }).optional()
});

// 検索リクエストのスキーマ
export const SearchRequestSchema = z.object({
  query: z.string().max(200).optional(),
  tags: z.array(z.string()).max(10).optional(),
  colors: z.array(z.string()).max(5).optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().max(1000000).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

// 使用例
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = GenerationRequestSchema.parse(body);

    // 処理続行...

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

### 10.4 環境変数管理

```bash
# .env.local (開発環境)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Services
DEEPSEEK_API_KEY=sk-...
IMAGINEAPI_BEARER=Bearer ...
HUGGINGFACE_API_KEY=hf_...

# Storage
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=owm-assets
R2_REGION=auto
R2_S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_PUBLIC_DOMAIN=assets.example.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CLIP_SERVER_URL=http://localhost:5001
```

---

## 11. デプロイメント

### 11.1 Vercelデプロイ

#### 11.1.1 プロジェクト設定

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "outputDirectory": "dist",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
    "DEEPSEEK_API_KEY": "@deepseek-key",
    "IMAGINEAPI_BEARER": "@imagine-bearer",
    "R2_ACCESS_KEY_ID": "@r2-access-key",
    "R2_SECRET_ACCESS_KEY": "@r2-secret-key",
    "R2_BUCKET": "@r2-bucket",
    "R2_S3_ENDPOINT": "@r2-endpoint"
  }
}
```

#### 11.1.2 ビルドスクリプト

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "nodemon server/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
    "build": "tsc && vite build && node scripts/copy-spa.mjs && next build",
    "preview": "vite preview"
  }
}
```

#### 11.1.3 デプロイコマンド

```bash
# 本番デプロイ
npx vercel --prod

# プレビューデプロイ
npx vercel

# 環境変数設定
npx vercel env add DEEPSEEK_API_KEY production
npx vercel env add IMAGINEAPI_BEARER production
```

### 11.2 CLIP Serverデプロイ

#### 11.2.1 Dockerコンテナ起動

```bash
# イメージビルド
docker build -t clip-server:latest -f server/Dockerfile.clip .

# コンテナ起動
docker run -d \
  --name clip-server \
  -p 5001:5001 \
  --restart unless-stopped \
  clip-server:latest
```

#### 11.2.2 GPU対応 (オプション)

```bash
# NVIDIA GPU使用
docker run -d \
  --name clip-server \
  --gpus all \
  -p 5001:5001 \
  --restart unless-stopped \
  clip-server:latest
```

### 11.3 データベースマイグレーション

#### 11.3.1 初期セットアップ

```bash
# Supabaseプロジェクト作成後、マイグレーション実行
psql "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.xxx.supabase.co:5432/postgres" \
  -f migrations/create_all_tables.sql
```

#### 11.3.2 マイグレーションスクリプト

```bash
#!/bin/bash
# scripts/migrate.sh

MIGRATIONS_DIR="migrations"
DB_URL="postgresql://postgres:$SUPABASE_DB_PASSWORD@db.xxx.supabase.co:5432/postgres"

for file in $(ls $MIGRATIONS_DIR/*.sql | sort); do
  echo "Applying migration: $file"
  psql "$DB_URL" -f "$file"

  if [ $? -eq 0 ]; then
    echo "✓ Migration applied successfully"
  else
    echo "✗ Migration failed"
    exit 1
  fi
done

echo "All migrations completed successfully"
```

### 11.4 監視・ログ

#### 11.4.1 Vercel Analytics

```typescript
// src/main.tsx
import { inject } from '@vercel/analytics';

inject();
```

#### 11.4.2 エラートラッキング

```typescript
// app/api/_shared/logger.ts
export const logger = {
  info: (message: string, meta?: object) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },

  error: (message: string, error: Error, meta?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
```

---

## 12. 開発ガイド

### 12.1 ローカル開発環境セットアップ

#### 12.1.1 必要な環境

- Node.js >= 20.0.0
- npm または yarn
- PostgreSQL (Supabase)
- Python 3.11 (CLIP Server用)
- Docker (オプション)

#### 12.1.2 セットアップ手順

```bash
# 1. リポジトリクローン
git clone https://github.com/your-username/OpenWardrobeMarket.git
cd OpenWardrobeMarket

# 2. 依存関係インストール
npm install

# 3. 環境変数設定
cp .env.example .env.local
# .env.local を編集して必要な環境変数を設定

# 4. データベースセットアップ
# Supabaseプロジェクト作成後、マイグレーション実行
psql "$DATABASE_URL" -f migrations/create_all_tables.sql

# 5. CLIP Server起動 (Python)
cd server
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python clip-server.py

# 6. 開発サーバー起動
npm run dev:all  # フロントエンド + バックエンド同時起動
```

### 12.2 開発フロー

#### 12.2.1 ブランチ戦略

```
master (main)     - 本番環境
  ├─ develop      - 開発統合
  │   ├─ feature/xxx  - 新機能開発
  │   ├─ fix/xxx      - バグ修正
  │   └─ refactor/xxx - リファクタリング
```

#### 12.2.2 コミット規約

```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント更新
style: コードスタイル修正
test: テスト追加・修正
chore: ビルド・設定変更

例:
feat: Add vector search functionality
fix: Fix authentication token refresh
docs: Update API documentation
```

### 12.3 テスト

#### 12.3.1 ユニットテスト

```typescript
// tests/utils/vector.test.ts
import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '@/app/lib/vector';

describe('vector utilities', () => {
  it('should calculate cosine similarity correctly', () => {
    const vec1 = [1, 0, 0];
    const vec2 = [0, 1, 0];

    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(0);
  });
});
```

#### 12.3.2 APIテスト

```typescript
// tests/api/chat.test.ts
import { describe, it, expect } from 'vitest';

describe('/api/chat', () => {
  it('should return AI response', async () => {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'カジュアルなドレスを作りたい'
      })
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('response');
  });
});
```

### 12.4 デバッグ

#### 12.4.1 フロントエンドデバッグ

```typescript
// React DevTools + Chrome DevTools使用

// デバッグログ
console.log('[Component] Render:', { props, state });

// パフォーマンス測定
console.time('fetch-data');
await fetchData();
console.timeEnd('fetch-data');
```

#### 12.4.2 バックエンドデバッグ

```typescript
// API Routes
export async function POST(request: NextRequest) {
  console.log('[API] Request:', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers)
  });

  try {
    const result = await processRequest();
    console.log('[API] Response:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error:', error);
    throw error;
  }
}
```

---

## 13. パフォーマンス最適化

### 13.1 フロントエンド最適化

#### 13.1.1 コード分割

```typescript
// Lazy Loading
const MobileCreatePage = lazy(() => import('./pages/mobile/MobileCreatePage'));
const MobileGalleryPage = lazy(() => import('./pages/mobile/MobileGalleryPage'));

// ルート単位での分割
<Suspense fallback={<Loading />}>
  <MobileCreatePage />
</Suspense>
```

#### 13.1.2 画像最適化

```typescript
// 遅延読み込み
<img
  src={image.url}
  loading="lazy"
  decoding="async"
  alt={image.title}
/>

// BlurHash使用
<BlurhashCanvas
  hash={image.blur_data_url}
  width={400}
  height={300}
/>
```

#### 13.1.3 メモ化

```typescript
// React.memo
export const PosterCard = React.memo(({ item }: Props) => {
  return <div>...</div>;
});

// useMemo
const filteredItems = useMemo(() => {
  return items.filter(item =>
    item.tags.some(tag => selectedTags.includes(tag))
  );
}, [items, selectedTags]);

// useCallback
const handleLike = useCallback((itemId: string) => {
  // ...
}, []);
```

### 13.2 バックエンド最適化

#### 13.2.1 データベースクエリ最適化

```sql
-- インデックス活用
CREATE INDEX idx_published_items_composite
ON published_items(is_public, is_active, created_at DESC);

-- 不要なカラム除外
SELECT id, title, image_url, tags, likes
FROM published_items
-- WHERE is_public = true は RLS で自動適用

-- ページネーション
LIMIT 20 OFFSET 0;
```

#### 13.2.2 キャッシュ戦略

```typescript
// メモリキャッシュ (開発用)
const cache = new Map<string, { data: any; expiry: number }>();

export function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = 300000 // 5分
): Promise<T> {
  const cached = cache.get(key);

  if (cached && Date.now() < cached.expiry) {
    return Promise.resolve(cached.data as T);
  }

  return fetchFn().then(data => {
    cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
    return data;
  });
}

// 使用例
const trendingItems = await getCached(
  'trending-7d',
  () => fetchTrendingItems(),
  300000 // 5分キャッシュ
);
```

### 13.3 ネットワーク最適化

#### 13.3.1 CDN活用

```typescript
// Cloudflare R2 + CDN
const imageUrl = `https://cdn.example.com/${r2Key}`;

// Cache-Control ヘッダー
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
```

#### 13.3.2 圧縮

```typescript
// Gzip/Brotli圧縮 (Vercel自動)

// 画像圧縮
import sharp from 'sharp';

const compressed = await sharp(buffer)
  .jpeg({ quality: 80, progressive: true })
  .toBuffer();
```

---

## 14. 今後の拡張予定

### 14.1 短期計画 (3ヶ月以内)

#### 14.1.1 決済システム統合

- Stripe統合
- アイテム購入機能
- サブスクリプションプラン
- 売上レポート

#### 14.1.2 コミュニティ機能

- ユーザーフォロー機能
- コメント・レビュー機能
- コレクション共有
- 通知システム

#### 14.1.3 高度なフィルタリング

- 価格範囲スライダー
- 複数カラーフィルタ
- スタイル組み合わせ検索
- 保存済み検索条件

### 14.2 中期計画 (6ヶ月以内)

#### 14.2.1 AR試着機能

- WebARライブラリ統合
- 3Dモデル生成
- バーチャル試着体験

#### 14.2.2 3Dファッションデザイン

- Three.js統合
- 3Dモデルエディタ
- 360度ビュー

#### 14.2.3 多言語対応

- i18n統合
- 英語・中国語・韓国語対応
- 地域別カタログ

### 14.3 長期計画 (12ヶ月以内)

#### 14.3.1 AI Model Self-Hosting

- 独自Stable Diffusion Fine-tuning
- LoRAモデル訓練
- プライベートAIインフラ

#### 14.3.2 Microservices化

- サービス分離 (Auth, Generation, Storage)
- API Gateway導入
- イベント駆動アーキテクチャ

#### 14.3.3 グローバル展開

- Multi-Region Deployment
- 地域別CDN
- 通貨・決済ローカライゼーション

---

## 付録

### A. 環境変数一覧

| 変数名 | 説明 | 必須 | デフォルト |
|--------|------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | ✅ | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | ✅ | - |
| `DEEPSEEK_API_KEY` | DeepSeek AI APIキー | ✅ | - |
| `IMAGINEAPI_BEARER` | ImagineAPI Bearer Token | ✅ | - |
| `HUGGINGFACE_API_KEY` | HuggingFace APIキー | ❌ | - |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key | ✅ | - |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Key | ✅ | - |
| `R2_BUCKET` | R2 Bucket名 | ✅ | - |
| `R2_S3_ENDPOINT` | R2 S3エンドポイント | ✅ | - |
| `R2_PUBLIC_DOMAIN` | R2公開ドメイン | ❌ | - |
| `NEXT_PUBLIC_APP_URL` | アプリケーションURL | ✅ | `http://localhost:3000` |
| `CLIP_SERVER_URL` | CLIP ServerURL | ✅ | `http://localhost:5001` |

### B. APIエンドポイント一覧

| メソッド | エンドポイント | 説明 | 認証 |
|---------|--------------|------|-----|
| POST | `/api/chat` | AI対話 | ✅ |
| POST | `/api/nano-generate` | 画像生成開始 | ✅ |
| GET | `/api/generation-stream/{taskId}` | 生成ステータス (SSE) | ✅ |
| POST | `/api/imagine-webhook` | ImagineAPI Webhook | ❌ |
| GET | `/api/search` | テキスト検索 | ❌ |
| POST | `/api/search` | 画像検索 | ❌ |
| GET | `/api/analytics` | 分析データ | ✅ |
| GET | `/api/recommend` | レコメンデーション | ❌ |
| POST | `/api/export` | 単一エクスポート | ✅ |
| POST | `/api/export/batch` | バッチエクスポート | ✅ |
| POST | `/api/likes` | いいね | ✅ |
| DELETE | `/api/likes/{itemId}` | いいね解除 | ✅ |
| GET | `/api/catalog` | カタログ取得 | ❌ |
| POST | `/api/generate-embedding` | embedding生成 | ✅ |
| GET | `/api/my-generations` | 自分の生成履歴 | ✅ |

### C. データベーステーブル一覧

| テーブル名 | 説明 | RLS |
|-----------|------|-----|
| `generation_history` | AI生成履歴 | ✅ |
| `published_items` | 公開アイテム | ✅ |
| `likes` | いいね | ✅ |
| `user_profiles` | ユーザープロファイル | ✅ |
| `dna_catalog` | スタイルDNAカタログ | ❌ |
| `collections` | コレクション | ✅ |
| `saved_items` | 保存済みアイテム | ✅ |

### D. 主要ライブラリバージョン

```json
{
  "react": "^18.2.0",
  "next": "^15.5.2",
  "typescript": "^5.0.2",
  "vite": "^4.4.5",
  "tailwindcss": "^3.3.3",
  "@supabase/supabase-js": "^2.56.0",
  "@react-three/fiber": "^8.18.0",
  "three": "^0.180.0",
  "lucide-react": "^0.542.0"
}
```

---

## まとめ

この仕様書は、**Open Wardrobe Market**の完全な技術仕様を網羅しています。

**主要特徴:**
- 🤖 AIを活用した直感的なデザイン生成
- 🔍 高度なベクトル検索とレコメンデーション
- 📊 包括的な分析とインサイト機能
- 🚀 スケーラブルなモダンアーキテクチャ
- 🔒 堅牢なセキュリティとRLS

**技術的ハイライト:**
- React 18 + Vite による高速フロントエンド
- Next.js 15 Serverless API
- Supabase (PostgreSQL + RLS + Auth)
- CLIP embeddings によるベクトル検索
- Cloudflare R2 による低コストストレージ

この仕様書を元に、プロジェクトの理解、開発、拡張を進めることができます。

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Generated with:** Claude Code 🤖

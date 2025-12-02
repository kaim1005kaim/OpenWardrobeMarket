# Open Wardrobe Market

オープンワードローブマーケットは、AIを活用したファッションデザイン生成・マーケットプレイスプラットフォームです。ユーザーは自然言語での会話を通じてオリジナルの服装デザインを作成し、マーケットプレイスで共有・販売することができます。

## 🌟 主な機能

### 🤖 AIファッションデザイン生成
- **対話型デザイン作成**: 自然言語での会話を通じた直感的なデザイン体験
- **DeepSeek AI統合**: 高品質なプロンプト生成でよりクリエイティブなデザイン
- **ImagineAPI連携**: Webhook使用でリアルタイム生成進捗表示
- **参考画像アップロード**: 既存画像を基にしたデザインカスタマイズ

### 🎨 デザインカスタマイズ
- **雰囲気選択**: カジュアル、エレガント、ボヘミアン、モダンなど12種類
- **シルエット設定**: Aライン、オーバーサイズ、タイトフィットなど9種類  
- **カラーパレット**: ナチュラル、ビビッド、パステル、モノクロなど8種類
- **リアルタイムプレビュー**: 設定変更に応じた即座のビジュアル更新

### 📊 包括的な分析機能
- **概要ダッシュボード**: 総生成数、公開アイテム数、いいね・ビュー数統計
- **生成履歴分析**: 日別生成数、頻繁に使用するパラメータ分析
- **スタイルトレンド**: 個人の嗜好と全体トレンドの比較
- **エンゲージメント分析**: 投稿パフォーマンスと時間帯別分析
- **マーケットプレイス分析**: カテゴリ別・価格帯別パフォーマンス

### 🎯 インテリジェントレコメンデーション
- **パーソナライズド推薦**: ユーザーの生成履歴に基づく個別推薦
- **トレンド推薦**: 直近7日間で人気のアイテム
- **類似アイテム推薦**: タグ、カラー、価格帯による類似度スコア算出
- **カテゴリ別推薦**: 特定ジャンルに特化した推薦
- **新着推薦**: 最新公開アイテムの推薦

### 🔍 高度な検索機能
- **マルチモーダル検索**: テキスト、タグ、カラー、価格での複合検索
- **インテリジェントフィルタリング**: 動的フィルタ条件の組み合わせ
- **ソート機能**: 関連度、価格、いいね数、ビュー数、投稿日時
- **検索候補**: 人気タグに基づく自動補完機能
- **検索履歴**: ユーザーの検索パターン学習

### 📤 多様なエクスポート機能
- **高解像度エクスポート**: Ultra/High/Medium/Low 4段階品質設定
- **多形式対応**: PNG、JPEG、WebP形式での出力
- **バッチエクスポート**: 最大10アイテムの一括ダウンロード
- **メタデータ付与**: 作成日時、タグ、パラメータ等の詳細情報
- **ZIP圧縮**: バッチエクスポート時の自動アーカイブ化

### 🌐 SNSシェア機能
- **マルチプラットフォーム対応**: Twitter、Instagram、Pinterest、Facebook、LINE
- **プラットフォーム最適化**: 各SNSの特性に合わせたシェア形式
- **ハッシュタグ自動生成**: デザインタグに基づく関連ハッシュタグ
- **カスタムメッセージ**: ユーザー独自のシェアメッセージ作成

### 👤 ユーザー管理・ギャラリー
- **マルチタイプギャラリー**: 生成済み、公開済み、保存済みアイテム管理
- **アイテム管理**: 編集、削除、公開設定の個別制御
- **コレクション機能**: お気に入りアイテムの整理・分類
- **プライバシー制御**: 公開範囲の細かな設定

## 🛠 技術スタック

### フロントエンド
- **React 18 + TypeScript**: 型安全なUI開発
- **Vite**: 高速な開発環境とバンドリング
- **Tailwind CSS**: ユーティリティファーストなスタイリング
- **Lucide React**: ミニマルなアイコンシステム
- **Server-Sent Events**: リアルタイム通信

### バックエンド・インフラ
- **Next.js API Routes**: サーバーレスAPI実装
- **Vercel**: 本番環境デプロイメント
- **Supabase**: PostgreSQLデータベース + 認証
- **Cloudflare R2**: 画像ストレージ
- **Row Level Security**: データベースレベルのセキュリティ

### AI・外部API
- **DeepSeek AI**: 自然言語プロンプト生成
- **ImagineAPI**: 画像生成エンジン
- **Webhook システム**: リアルタイム生成ステータス更新
- **Sharp**: サーバーサイド画像処理

## 📁 プロジェクト構造

```
/
├── api/                    # Next.js API Routes
│   ├── analytics.ts        # 分析・インサイト機能
│   ├── deepseek-prompt.ts  # AI プロンプト生成
│   ├── export.ts          # 高解像度エクスポート
│   ├── imagine-webhook.ts  # ImagineAPI Webhook
│   ├── recommend.ts       # レコメンデーション
│   ├── saved.ts           # 保存済みアイテム
│   ├── search.ts          # 検索機能
│   ├── share.ts           # SNS シェア
│   └── user-gallery.ts    # ユーザーギャラリー
├── src/
│   ├── app/
│   │   ├── components/     # React コンポーネント
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── AuthModal.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── Gallery.tsx
│   │   │   ├── Icons.tsx
│   │   │   └── ...
│   │   ├── lib/           # ユーティリティ・設定
│   │   │   ├── AuthContext.tsx
│   │   │   ├── supabase.ts
│   │   │   └── types.ts
│   │   └── styles/        # スタイル定義
├── docs/                  # プロジェクトドキュメント
└── README.md             # プロジェクト概要
```

## 🗄 データベース設計

### Core Tables
- **generation_history**: AI生成履歴とパラメータ
- **published_items**: 公開マーケットプレイスアイテム
- **collections**: ユーザーコレクション・お気に入り
- **user_analytics_summary**: 分析用マテリアライズドビュー

### セキュリティ
- Row Level Security (RLS) 全テーブル適用
- JWT ベース認証システム
- APIキー・環境変数による外部サービス保護

## 🚀 デプロイメント

### 環境変数
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# AI Services  
DEEPSEEK_API_KEY=your_deepseek_key
IMAGINEAPI_BEARER=your_imagine_token

# Storage
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET=your_bucket_name
R2_REGION=auto
R2_S3_ENDPOINT=your_r2_endpoint

# App
NEXT_PUBLIC_APP_URL=your_production_url
```

### デプロイ手順
```bash
# 依存関係インストール
npm install

# ビルドテスト
npm run build

# 本番デプロイ
npx vercel --prod
```

## 📈 パフォーマンス最適化

- **マテリアライズドビュー**: 分析クエリの高速化
- **画像最適化**: Sharp による動的リサイズ・圧縮
- **API レスポンス最適化**: 選択的データフェッチ
- **キャッシュ戦略**: ブラウザ・CDN キャッシュ活用

## 🔮 今後の拡張予定

- **決済システム統合**: Stripe による売買機能
- **AR試着機能**: WebAR によるバーチャル試着
- **3Dモデル対応**: 3Dファッションデザイン生成
- **コミュニティ機能**: ユーザー間のフォロー・コメント
- **多言語対応**: 国際展開に向けた多言語化

## 🤝 コントリビューション

このプロジェクトは Claude Code と協力して開発されました。バグレポートや機能要望は Issue からお願いします。

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

---

**Open Wardrobe Market** - AI Powered Fashion Design Platform
# CLIP Server Deployment

# CLIP Server - Cloud Run Deployment Guide

## 概要
このガイドでは、CLIPサーバーをGoogle Cloud Runにデプロイする手順を説明します。

## 前提条件
- Google Cloud Platformアカウント
- gcloud CLI インストール済み
- プロジェクトの請求先アカウント設定済み

## 🚀 クイックスタート

### 1. gcloud CLIのインストール（初回のみ）

```bash
# macOS
brew install --cask google-cloud-sdk

# または公式インストーラー
# https://cloud.google.com/sdk/docs/install
```

### 2. gcloudの初期化

```bash
# ログイン
gcloud auth login

# プロジェクトの作成（または既存プロジェクトを選択）
gcloud projects create open-wardrobe-market --name="Open Wardrobe Market"

# プロジェクトを設定
gcloud config set project open-wardrobe-market

# 請求先アカウントの確認
gcloud beta billing accounts list

# 請求先アカウントをプロジェクトにリンク
gcloud beta billing projects link open-wardrobe-market \\
    --billing-account=YOUR_BILLING_ACCOUNT_ID
```

### 3. デプロイ実行

```bash
cd /Volumes/SSD02/Private/Dev/OpenWardrobeMarket/server

# デプロイスクリプト実行
./deploy-cloudrun.sh open-wardrobe-market us-central1
```

### 4. Vercel環境変数の設定

```bash
# デプロイ後に表示されるURLをコピーして設定
cd /Volumes/SSD02/Private/Dev/OpenWardrobeMarket

# 本番環境
vercel env add CLIP_SERVER_URL production
# 値を入力: https://clip-server-xxxxx-uc.a.run.app

# プレビュー環境（オプション）
vercel env add CLIP_SERVER_URL preview
# 値を入力: https://clip-server-xxxxx-uc.a.run.app

# 開発環境（ローカルのまま）
vercel env add CLIP_SERVER_URL development
# 値を入力: http://localhost:5001
```

### 5. 動作確認

```bash
# ヘルスチェック
curl https://clip-server-xxxxx-uc.a.run.app/health

# 埋め込み生成テスト
curl -X POST https://clip-server-xxxxx-uc.a.run.app/embed \\
  -F "image=@test-image.jpg"
```

## 📊 コスト見積もり

### 無料枠（毎月）
- 2M requests
- 360,000 vCPU-seconds
- 180,000 GiB-seconds

### 有料枠（超過分）
- CPU: $0.00002400/vCPU-sec
- メモリ: $0.00000250/GiB-sec

### 月間1000リクエストの場合
- 1リクエスト = 平均5秒処理
- CPU使用: 1000 × 5 × 2 vCPU = 10,000 vCPU-sec
- メモリ使用: 1000 × 5 × 4 GB = 20,000 GiB-sec
- **推定コスト: $0.24 + $0.05 = $0.29/月**

### 月間10,000リクエストの場合
- **推定コスト: 約$3-5/月**

## 🔧 トラブルシューティング

### エラー: "Permission denied"
```bash
# IAM権限を確認
gcloud projects get-iam-policy open-wardrobe-market

# 必要な権限を追加
gcloud projects add-iam-policy-binding open-wardrobe-market \\
    --member="user:your-email@example.com" \\
    --role="roles/run.admin"
```

### エラー: "The user does not have permission to access project"
```bash
# プロジェクトIDを確認
gcloud projects list

# 正しいプロジェクトを設定
gcloud config set project YOUR_CORRECT_PROJECT_ID
```

### デプロイが遅い（10分以上）
- 初回デプロイ時はCLIPモデルのダウンロードに時間がかかります
- ビルドログを確認: `gcloud builds log --stream`

### メモリ不足エラー
```bash
# メモリを増やしてデプロイ
gcloud run deploy clip-server \\
    --image gcr.io/open-wardrobe-market/clip-server \\
    --memory 8Gi \\
    --cpu 4
```

## 🛠️ カスタマイズ

### モデルの変更
`Dockerfile.cloudrun` を編集:
```dockerfile
# vit-b-32 → vit-l-14 に変更
RUN python -c "from transformers import CLIPProcessor, CLIPModel; \\
    CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14'); \\
    CLIPModel.from_pretrained('openai/clip-vit-large-patch14')"

CMD ["python", "clip-server.py", "--model", "vit-l-14", ...]
```

### レート制限の追加
`clip-server.py` に追加:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)
```

## 📈 モニタリング

### ログの確認
```bash
# リアルタイムログ
gcloud run services logs tail clip-server --region us-central1

# 過去のログ
gcloud logging read "resource.type=cloud_run_revision" \\
    --limit 50 \\
    --format json
```

### メトリクスの確認
```bash
# Cloud Consoleで確認
open "https://console.cloud.google.com/run/detail/us-central1/clip-server/metrics"
```

## 🔄 更新とロールバック

### コードを更新してデプロイ
```bash
cd /Volumes/SSD02/Private/Dev/OpenWardrobeMarket/server
./deploy-cloudrun.sh
```

### 以前のバージョンにロールバック
```bash
# リビジョン一覧
gcloud run revisions list --service clip-server --region us-central1

# ロールバック
gcloud run services update-traffic clip-server \\
    --to-revisions REVISION_NAME=100 \\
    --region us-central1
```

## 🗑️ 削除

### サービスの削除
```bash
gcloud run services delete clip-server --region us-central1
```

### Dockerイメージの削除
```bash
gcloud container images delete gcr.io/open-wardrobe-market/clip-server
```

## 🔗 関連リンク
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [CLIP Model](https://github.com/openai/CLIP)

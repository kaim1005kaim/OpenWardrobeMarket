# Vertex AI Imagen 3 セットアップ手順

Variant画像生成機能はGoogle Cloud Vertex AIのImagen 3を使用します。

## 1. Google Cloud Projectの作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）
3. プロジェクトIDをメモ（例: `my-fashion-app-123456`）

## 2. Vertex AI APIの有効化

```bash
gcloud services enable aiplatform.googleapis.com
```

または、[APIライブラリ](https://console.cloud.google.com/apis/library)から「Vertex AI API」を検索して有効化

## 3. 認証の設定

### 開発環境（ローカル）

```bash
# Google Cloud CLIでログイン
gcloud auth application-default login

# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID
```

### 本番環境（Vercel）

1. サービスアカウントを作成:
```bash
gcloud iam service-accounts create vertex-ai-service \
    --display-name="Vertex AI Service Account"
```

2. 権限を付与:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:vertex-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

3. キーを作成:
```bash
gcloud iam service-accounts keys create vertex-ai-key.json \
    --iam-account=vertex-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

4. Vercelの環境変数に設定:
   - `GOOGLE_CLOUD_PROJECT`: YOUR_PROJECT_ID
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON`: `vertex-ai-key.json`の内容全体をJSON文字列として貼り付け

## 4. 環境変数の設定

### `.env.local` (開発環境)
```
GOOGLE_CLOUD_PROJECT=your-project-id
```

### Vercel (本番環境)
```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
```

## 5. Imagen 3の有効化

Imagen 3は現在限定プレビューです。アクセスをリクエストする必要があります:

1. [Vertex AI Studio](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration)にアクセス
2. 「Imagen 3」を選択
3. 「アクセスをリクエスト」をクリック
4. 承認されるまで待機（通常1-3営業日）

## 6. 動作確認

```bash
npm run dev
```

FUSIONで画像を生成→公開画面で自動的にside/back画像が生成開始されます。

## トラブルシューティング

### エラー: "Unable to load legacy provider"
→ Google Cloud認証が設定されていません。手順3を確認してください。

### エラー: "Permission denied"
→ サービスアカウントに`roles/aiplatform.user`権限が付与されていません。

### エラー: "Imagen 3 model not found"
→ Imagen 3へのアクセスがまだ承認されていません。手順5を確認してください。

## コスト

- Imagen 3: $0.04 per image (1024x1024まで)
- Variant生成: 1回のFUSIONで2画像生成 = $0.08
- 月100回のFUSION = 約$8

詳細: https://cloud.google.com/vertex-ai/pricing#image-generation

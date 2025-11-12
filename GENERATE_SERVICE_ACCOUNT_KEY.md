# 新しいサービスアカウントキーの生成方法

## 手順1: Google Cloud Consoleにアクセス

1. **Google Cloud Console**を開く:
   ```
   https://console.cloud.google.com/
   ```

2. プロジェクト`owm-production`を選択

---

## 手順2: サービスアカウントページに移動

1. 左側のメニューから **「IAMと管理」** → **「サービスアカウント」** を選択

   または直接アクセス:
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=owm-production
   ```

2. 既存のサービスアカウントを確認:
   - `owm-vertex-ai@owm-production.iam.gserviceaccount.com`

---

## 手順3: 新しいキーを生成

### 方法A: 既存のサービスアカウントに新しいキーを追加

1. サービスアカウント `owm-vertex-ai@owm-production.iam.gserviceaccount.com` をクリック

2. 上部タブの **「キー」** をクリック

3. **「鍵を追加」** → **「新しい鍵を作成」** をクリック

4. キーのタイプで **「JSON」** を選択

5. **「作成」** をクリック

6. **JSONファイルが自動的にダウンロード**されます（例: `owm-production-xxxxx.json`）

### 方法B: 新しいサービスアカウントを作成（推奨）

既存のキーが古い場合は、新しいサービスアカウントを作成することをお勧めします。

1. **「サービスアカウントを作成」** をクリック

2. サービスアカウントの詳細を入力:
   - **名前**: `owm-imagen3-api`
   - **ID**: `owm-imagen3-api`（自動生成）
   - **説明**: `Service account for Imagen 3 variant generation`

3. **「作成して続行」** をクリック

4. ロール（役割）を付与:
   - **「Vertex AI ユーザー」** (`roles/aiplatform.user`)を選択
   - **「ストレージ オブジェクト作成者」** (`roles/storage.objectCreator`)も追加（R2アップロード用）

5. **「続行」** をクリック

6. **「完了」** をクリック

7. 作成したサービスアカウントをクリック

8. **「キー」** タブ → **「鍵を追加」** → **「新しい鍵を作成」**

9. **「JSON」** を選択 → **「作成」**

10. **JSONファイルがダウンロード**されます

---

## 手順4: JSONキーの内容を確認

ダウンロードしたJSONファイル（例: `owm-production-xxxxx.json`）を開くと、以下のような内容になっています:

```json
{
  "type": "service_account",
  "project_id": "owm-production",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n",
  "client_email": "owm-vertex-ai@owm-production.iam.gserviceaccount.com",
  "client_id": "xxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/...",
  "universe_domain": "googleapis.com"
}
```

---

## 手順5: .env.localを更新

1. ダウンロードしたJSONファイルの**内容全体**をコピー

2. `.env.local`ファイルを開く

3. `GOOGLE_APPLICATION_CREDENTIALS_JSON=`の値を、コピーしたJSON全体に置き換える

   **重要**: JSONは1行にする必要があります。改行を含めずに貼り付けてください。

   例:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"owm-production","private_key_id":"xxxxx","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n","client_email":"owm-vertex-ai@owm-production.iam.gserviceaccount.com",...}
   ```

4. ファイルを保存

---

## 手順6: テストスクリプトで確認

新しいキーが正しく動作するか確認:

```bash
node -r dotenv/config scripts/test-imagen3-oauth.ts dotenv_config_path=.env.local
```

成功すると以下のように表示されます:

```
✅ GOOGLE_CLOUD_PROJECT: owm-production
✅ Credentials parsed
   - Service Account: owm-vertex-ai@owm-production.iam.gserviceaccount.com
🔑 Getting OAuth access token...
✅ Access token obtained
📍 Endpoint: https://us-central1-aiplatform.googleapis.com/v1/...
🔄 Sending request...
📥 Response status: 200 OK
✅ レスポンス受信成功！
🎉 Imagen 3 APIは正常に動作しています！
```

---

## 手順7: Vercelの環境変数を更新

1. **Vercel Dashboard**にアクセス:
   ```
   https://vercel.com/
   ```

2. プロジェクト **「OpenWardrobeMarket」** を選択

3. **「Settings」** → **「Environment Variables」** に移動

4. `GOOGLE_APPLICATION_CREDENTIALS_JSON` を探す

5. **「Edit」** をクリック

6. 新しいJSONキーの内容を貼り付け（1行で）

7. **「Save」** をクリック

8. 変更を反映するため、**再デプロイが必要**です

---

## トラブルシューティング

### エラー: "error:1E08010C:DECODER routines::unsupported"

**原因**: 秘密鍵のフォーマットが壊れている

**解決策**:
1. 新しいキーを生成し直す
2. JSONをコピーする際、改行や余分なスペースが入らないようにする
3. テキストエディタで確認して、`private_key`フィールドに`\n`が正しく含まれているか確認

### エラー: "403 Permission Denied"

**原因**: サービスアカウントに権限がない

**解決策**:
```bash
gcloud projects add-iam-policy-binding owm-production \
  --member="serviceAccount:owm-vertex-ai@owm-production.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### エラー: "404 Model not found"

**原因**: Imagen 3へのアクセスが許可されていない

**解決策**:
1. Vertex AI Studioでアクセスをリクエスト:
   ```
   https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration?project=owm-production
   ```
2. 「REQUEST ACCESS」をクリック
3. 1〜3営業日待つ

---

## セキュリティ注意事項

⚠️ **重要**:
- サービスアカウントキーは**秘密情報**です
- GitHubにコミットしないでください
- `.env.local`は`.gitignore`に含まれていることを確認してください
- 古いキーは削除してください（Google Cloud Console → サービスアカウント → キー → 削除）

---

## 次のステップ

キーの生成と設定が完了したら:

1. ✅ ローカルでテストスクリプトを実行
2. ✅ Vercelの環境変数を更新
3. ✅ 再デプロイ
4. ✅ 実際のFUSION画像でバリアント生成をテスト

---

## 参考リンク

- [Google Cloud Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=owm-production)
- [Vertex AI API](https://console.cloud.google.com/apis/api/aiplatform.googleapis.com?project=owm-production)
- [Imagen 3 Model Garden](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/imagegeneration?project=owm-production)

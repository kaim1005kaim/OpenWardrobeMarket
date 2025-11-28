# FUSION画像アップロード問題 - Gemini報告

## 実施した修正

### 1. Geminiからの指示
Geminiから以下の指示を受けました:

1. **サーバー経由のアップロード（Proxy方式）を中止**
   - Vercel経由のアップロードはSSL/TLSハンドシェイクの問題が解決困難
   - 「二重の通信（Double Hop）」によるタイムアウト問題

2. **Presigned URL方式に戻す**
   - モバイルアプリ → R2に直接アップロード
   - Vercelを経由しないため、SSL問題を回避

3. **R2 CORS設定が最重要**
   - CORSが正しく設定されていないと`FileSystem.uploadAsync()`は無言でハング

### 2. 実施した修正

#### モバイルアプリ側の修正
ファイル: `/Users/kaimoriguchi/OpenWardrobeMarket_app/lib/fusion-api.ts`

**変更前（サーバー経由）:**
```typescript
export async function uploadImageToR2(imageUri: string): Promise<string> {
  // base64に変換
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // サーバーにPOST
  const response = await fetch(`${API_BASE_URL}/api/upload-to-r2`, {
    method: 'POST',
    body: JSON.stringify({ imageData: base64, mimeType }),
  });

  return result.imageUrl;
}
```

**変更後（Presigned URL方式）:**
```typescript
export async function uploadImageToR2(imageUri: string): Promise<string> {
  // Step 1: Presigned URLを取得
  const key = `fusion/anonymous/${timestamp}-${randomStr}.${extension}`;
  const contentType = `image/jpeg`;

  const presignUrl = `${API_BASE_URL}/api/r2-presign?key=${key}&contentType=${contentType}`;
  const presignResponse = await fetch(presignUrl);
  const { uploadUrl } = await presignResponse.json();

  // Step 2: R2に直接アップロード
  const uploadResponse = await FileSystem.uploadAsync(uploadUrl, imageUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': contentType,
    },
  });

  // Step 3: 公開URLを構築
  const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;
  return publicUrl;
}
```

#### R2 CORS設定
Cloudflareダッシュボードで以下のCORS設定を適用:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## 現在の状況

### ログ出力
```
[uploadImageToR2] Starting presigned URL upload for: file://...
[uploadImageToR2] Generated key: fusion/anonymous/1764322615186-uk2a5.jpg
[uploadImageToR2] Content-Type: image/jpeg
[uploadImageToR2] Requesting presigned URL...
[uploadImageToR2] Got presigned URL
[uploadImageToR2] Starting direct upload to R2...
```

**問題点:**
- "Upload response status:" のログが出ない
- `FileSystem.uploadAsync()`がハングして完了しない

### 環境情報

**R2バケット設定:**
- バケット名: `owm-assets`
- エンドポイント: `https://[account-id].r2.cloudflarestorage.com`
- 公開URL: `https://assets.open-wardrobe-market.com`
- CORS設定: 上記JSON（保存済み）

**モバイルアプリ:**
- React Native (Expo SDK 52)
- `expo-file-system` 使用
- iOS シミュレータでテスト

**サーバー:**
- Next.js (Vercel)
- `/api/r2-presign` エンドポイントでPresigned URL生成
- `@aws-sdk/client-s3` と `@aws-sdk/s3-request-presigner` 使用

### Presigned URLエンドポイントのコード

```typescript
// /app/api/r2-presign/route.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  endpoint: process.env.R2_S3_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      requestCert: false,
      checkServerIdentity: () => undefined,
      maxVersion: 'TLSv1.3',
      minVersion: 'TLSv1.2',
    }),
  }),
  tls: false,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const contentType = searchParams.get('contentType');

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

  return NextResponse.json({ uploadUrl });
}
```

## 質問

1. **CORS設定は正しいか？**
   - `AllowedOrigins: ["*"]` でワイルドカード使用は問題ないか？
   - React Nativeアプリからの`Origin`ヘッダーはどうなっているか？

2. **Presigned URLの生成方法は正しいか？**
   - `ContentType`をPutObjectCommandに含める必要があるか？
   - モバイル側のヘッダーと一致している必要があるか？

3. **`FileSystem.uploadAsync()`がハングする原因は？**
   - CORS以外に考えられる原因は？
   - タイムアウト設定が必要か？
   - デバッグ方法は？

4. **次に試すべきことは？**
   - CORS設定の反映待ち時間は？
   - 別のテスト方法はあるか？
   - エラーハンドリングを追加すべきか？

## 期待される動作

成功時のログ:
```
[uploadImageToR2] Starting presigned URL upload for: ...
[uploadImageToR2] Generated key: fusion/anonymous/...
[uploadImageToR2] Content-Type: image/jpeg
[uploadImageToR2] Requesting presigned URL...
[uploadImageToR2] Got presigned URL
[uploadImageToR2] Starting direct upload to R2...
[uploadImageToR2] Upload response status: 200  ← これが出ない！
[uploadImageToR2] Upload successful: https://...
```

その後、`analyzeFusion()`が呼ばれて分析が開始されるはず。

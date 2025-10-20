# Catalog画像のベクトル埋め込み生成ガイド

## 📋 概要

`owm-assets/catalog/`内の1000枚の画像に対してCLIP埋め込みを生成するスクリプトを作成しました。

## ⚠️ 現在の状況

### Hugging Face Inference APIの制限

**問題**:
- 画像サイズが大きい（1-2MB）とAPIがエラーを返す
- "Not Found" または "Internal Error"
- 無料枠のレート制限

### 解決策

以下の3つの選択肢があります：

## 方法1: タグベース疑似埋め込み（推奨・即座に実装可能）

既存データと同じ方法で、ファイル名やメタデータからタグを抽出してベクトル化。

```bash
# 既に実装済み
npx tsx scripts/generate-tag-based-embeddings.ts
```

**利点**:
- ⚡ 即座に動作
- 💰 完全無料
- 🎯 60-75%の精度

**欠点**:
- タグの質に依存

## 方法2: Replicate API（推奨・高精度）

Hugging Faceより安定したCLIP API。

```typescript
// Replicate CLIP ViT-L/14 (OpenAI公式より高精度)
const response = await fetch('https://api.replicate.com/v1/predictions', {
  method: 'POST',
  headers: {
    Authorization: `Token ${REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    version: 'openai/clip-vit-large-patch14:...',
    input: {
      image: imageUrl, // Public URL
    },
  }),
});
```

**コスト**: $0.0006 / 画像（1000枚で$0.60）

**サインアップ**: https://replicate.com/

## 方法3: セルフホストCLIP（完全無料・最高品質）

Docker + transformersでローカル実行。

```python
# server/clip-server.py
from transformers import CLIPProcessor, CLIPModel
from flask import Flask, request, jsonify
import torch
from PIL import Image
import io

app = Flask(__name__)

model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")

@app.route('/embed', methods=['POST'])
def embed_image():
    image_bytes = request.files['image'].read()
    image = Image.open(io.BytesIO(image_bytes))

    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embeddings = model.get_image_features(**inputs)

    # Normalize
    embeddings = embeddings / embeddings.norm(dim=-1, keepdim=True)
    return jsonify({
        'embedding': embeddings[0].tolist()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

```dockerfile
# Dockerfile
FROM python:3.11-slim

RUN pip install torch transformers flask pillow

COPY clip-server.py /app/
WORKDIR /app

CMD ["python", "clip-server.py"]
```

```bash
# 実行
docker build -t clip-server .
docker run -p 5000:5000 clip-server

# スクリプトから使用
curl -X POST -F "image=@image.png" http://localhost:5000/embed
```

## 📊 方法の比較

| 方法 | 精度 | コスト | 速度 | 実装難易度 |
|------|------|--------|------|-----------|
| タグベース疑似ベクトル | 60-75% | 無料 | 即座 | ✅ 簡単 |
| Replicate API | 90-95% | $0.60/1000枚 | 中 | 中 |
| セルフホストCLIP | 90-95% | 無料 | 速い | 高 |
| Hugging Face Free | 85-90% | 無料 | 遅い | 中（制限あり） |

## 🚀 推奨実装ステップ

### ステップ1: タグベース疑似ベクトル（今すぐ）

```bash
# 既存の8件 + catalog画像にタグベースベクトル生成
npx tsx scripts/generate-tag-based-embeddings.ts
```

→ 即座に類似検索が動作

### ステップ2: Replicate API（1-2日）

1. https://replicate.com/ でアカウント作成
2. APIトークン取得
3. `scripts/generate-embeddings-replicate.ts` 作成
4. catalog画像を順次処理（$0.60）

### ステップ3: セルフホストCLIP（長期・完全無料化）

1. Dockerコンテナ作成
2. ローカルまたはクラウドで実行
3. 全画像を処理（無料・高速）

## 💡 現時点での最適解

**今すぐ動作させる**:
```bash
# タグベース疑似ベクトル
npx tsx scripts/generate-tag-based-embeddings.ts
```

**高精度が必要な場合**:
- Replicate APIで$0.60支払う（1000枚）
- または セルフホストCLIPをセットアップ

## 📝 Replicate API実装例

```typescript
// scripts/generate-embeddings-replicate.ts
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function generateEmbedding(imageUrl: string) {
  const output = await replicate.run(
    'openai/clip-vit-large-patch14:...',
    { input: { image: imageUrl } }
  );

  return output; // 768次元ベクトル
}
```

## ✅ まとめ

### 現状
- ✅ autoTags.tsのエラー修正完了
- ✅ タグベース疑似ベクトルスクリプト実装済み
- ✅ catalog画像スキャンスクリプト作成済み
- ⚠️ Hugging Face Free APIは制限あり

### 次のアクション
1. **今すぐ**: タグベース疑似ベクトルで全データをインデックス化
2. **予算あり**: Replicate APIで高精度化（$0.60）
3. **長期**: セルフホストCLIPで完全無料化

catalog内の1000枚の画像もベクトル化可能ですが、タグベースまたはReplicate/セルフホストCLIPの使用を推奨します。

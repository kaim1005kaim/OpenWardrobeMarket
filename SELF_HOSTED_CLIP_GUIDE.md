# Self-Hosted CLIP Guide (無料・高速)

## 概要

このガイドでは、OpenAI の CLIP モデルをセルフホストして、無料・無制限で画像の埋め込みベクトルを生成する方法を説明します。

### なぜセルフホスト？

| 方法 | コスト | 速度 | 制限 | 品質 |
|------|--------|------|------|------|
| Hugging Face API (無料) | 無料 | 遅い | 画像サイズ制限、レート制限、エラー頻発 | 中 (vit-b-32) |
| Replicate API | $0.60/1000枚 | 速い | 従量課金 | 高 (vit-l-14) |
| **セルフホスト** | **無料** | **超高速 (GPU)** | **無制限** | **最高 (vit-l-14-336)** |

### 主な利点

✅ **完全無料** - API料金なし、無制限
✅ **高速処理** - GPU使用時は10-100倍速
✅ **高品質** - 大型モデル (vit-l-14-336) 使用可能
✅ **安定性** - レート制限なし、エラーなし
✅ **プライバシー** - 画像データが外部に送信されない

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  TypeScript Script (Node.js)                                │
│  ├─ scripts/generate-embeddings-from-catalog.ts             │
│  └─ app/api/generate-embedding/route.ts                     │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTP POST /embed
┌─────────────────────────────────────────────────────────────┐
│  Flask REST API (server/clip-server.py)                     │
│  ├─ POST /embed        - 単一画像                            │
│  ├─ POST /embed/batch  - バッチ処理                          │
│  ├─ GET  /health       - ヘルスチェック                       │
│  └─ GET  /models       - 利用可能なモデル一覧                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  PyTorch + Transformers                                     │
│  ├─ CLIP Model (vit-b-32 / vit-b-16 / vit-l-14)           │
│  ├─ Image Preprocessing                                     │
│  └─ Feature Extraction                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Device (CPU / CUDA / MPS)                                  │
│  ├─ CPU: どこでも動作 (~500ms/画像)                           │
│  ├─ CUDA: NVIDIA GPU (~50ms/画像)                           │
│  └─ MPS: Apple Silicon M1/M2/M3 (~100ms/画像)               │
└─────────────────────────────────────────────────────────────┘
```

---

## インストール方法

### 方法1: ローカル実行 (推奨 - Mac/Linux)

#### 1. Python環境のセットアップ

```bash
cd server/

# 仮想環境を作成
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係をインストール
pip install -r requirements.txt
```

#### 2. サーバーの起動

```bash
# CPU版 (どこでも動作)
python clip-server.py --model vit-b-32 --device cpu

# GPU版 (NVIDIA CUDA)
python clip-server.py --model vit-l-14 --device cuda

# GPU版 (Apple Silicon M1/M2/M3)
python clip-server.py --model vit-l-14 --device mps
```

#### 3. 動作確認

```bash
curl http://localhost:5000/health
# → {"status": "healthy", "model": "vit-b-32", "device": "cpu"}
```

---

### 方法2: Docker (クロスプラットフォーム)

#### 1. Docker イメージのビルド

```bash
docker build -t clip-server -f server/Dockerfile.clip server/
```

#### 2. コンテナの起動

```bash
# CPU版
docker run -p 5000:5000 clip-server

# GPU版 (NVIDIA Docker が必要)
docker run --gpus all -p 5000:5000 clip-server \
  python clip-server.py --model vit-l-14 --device cuda
```

---

## 利用可能なモデル

| モデル | 次元数 | 精度 | 速度 | 推奨用途 |
|--------|--------|------|------|----------|
| **vit-b-32** | 512 | 標準 | 最速 | 開発・テスト |
| **vit-b-16** | 512 | 高 | 速い | バランス重視 |
| **vit-l-14** | 768 | 最高 | 中速 | 本番環境 |
| **vit-l-14-336** | 768 | 最高+ | 遅い | 最高品質 |

### モデルの切り替え

```bash
# 高品質モデルに変更
python clip-server.py --model vit-l-14 --device cuda

# 最高品質モデル (336x336 入力)
python clip-server.py --model vit-l-14-336 --device cuda
```

---

## API エンドポイント

### 1. `/embed` - 単一画像の埋め込み生成

```bash
curl -X POST http://localhost:5000/embed \
  -F "image=@/path/to/image.jpg"
```

**レスポンス:**
```json
{
  "embedding": [0.123, -0.456, 0.789, ...],  // 512 or 768 dimensions
  "dimensions": 512,
  "model": "vit-b-32"
}
```

### 2. `/embed/batch` - バッチ処理

```bash
curl -X POST http://localhost:5000/embed/batch \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "images=@image3.jpg"
```

**レスポンス:**
```json
{
  "embeddings": [
    [0.123, -0.456, ...],
    [0.234, -0.567, ...],
    [0.345, -0.678, ...]
  ],
  "count": 3,
  "dimensions": 512
}
```

### 3. `/health` - ヘルスチェック

```bash
curl http://localhost:5000/health
```

**レスポンス:**
```json
{
  "status": "healthy",
  "model": "vit-b-32",
  "device": "cuda",
  "dimensions": 512
}
```

### 4. `/models` - 利用可能なモデル一覧

```bash
curl http://localhost:5000/models
```

**レスポンス:**
```json
{
  "models": ["vit-b-32", "vit-b-16", "vit-l-14", "vit-l-14-336"],
  "current": "vit-b-32"
}
```

---

## TypeScript から使用する

### 既存のスクリプトを修正

#### `scripts/generate-embeddings-from-catalog.ts`

```typescript
// BEFORE: Hugging Face API
const response = await fetch(
  'https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: base64Image,
      options: { wait_for_model: true },
    }),
  }
);

// AFTER: Self-hosted CLIP
const formData = new FormData();
formData.append('image', imageBuffer, { filename: 'image.jpg' });

const response = await fetch('http://localhost:5000/embed', {
  method: 'POST',
  body: formData,
});

const { embedding } = await response.json();
```

### 新しいヘルパー関数

```typescript
// lib/clipClient.ts
export async function generateEmbeddingLocal(
  imageBuffer: Buffer
): Promise<number[]> {
  const formData = new FormData();
  formData.append('image', imageBuffer, { filename: 'image.jpg' });

  const response = await fetch('http://localhost:5000/embed', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`CLIP server error: ${response.statusText}`);
  }

  const { embedding } = await response.json();
  return embedding;
}

// バッチ処理版
export async function generateEmbeddingsBatch(
  imageBuffers: Buffer[]
): Promise<number[][]> {
  const formData = new FormData();
  imageBuffers.forEach((buffer, i) => {
    formData.append('images', buffer, { filename: `image${i}.jpg` });
  });

  const response = await fetch('http://localhost:5000/embed/batch', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`CLIP server error: ${response.statusText}`);
  }

  const { embeddings } = await response.json();
  return embeddings;
}
```

---

## カタログ画像の一括処理

### スクリプトの実行

```bash
# CLIPサーバーを起動 (別ターミナル)
cd server/
python clip-server.py --model vit-l-14 --device cuda

# カタログ画像を処理
npm run tsx scripts/generate-embeddings-from-catalog.ts
```

### 処理時間の目安

| GPU | モデル | 1000枚の処理時間 |
|-----|--------|------------------|
| CPU (M2 Max) | vit-b-32 | ~8分 |
| CPU (M2 Max) | vit-l-14 | ~15分 |
| MPS (M2 Max) | vit-l-14 | ~2分 |
| CUDA (RTX 4090) | vit-l-14 | ~50秒 |
| CUDA (RTX 4090) | vit-l-14-336 | ~2分 |

---

## パフォーマンス最適化

### 1. バッチ処理の活用

```typescript
// ❌ 悪い例: 1枚ずつ処理
for (const image of images) {
  const embedding = await generateEmbeddingLocal(image);
  await saveToDatabase(embedding);
}

// ✅ 良い例: バッチ処理
const BATCH_SIZE = 32;
for (let i = 0; i < images.length; i += BATCH_SIZE) {
  const batch = images.slice(i, i + BATCH_SIZE);
  const embeddings = await generateEmbeddingsBatch(batch);
  await saveBatchToDatabase(embeddings);
}
```

### 2. 並列処理

```python
# server/clip-server.py に追加
@app.route('/embed/batch', methods=['POST'])
def embed_batch():
    files = request.files.getlist('images')
    images = [Image.open(io.BytesIO(f.read())).convert('RGB') for f in files]

    # バッチ処理で高速化
    inputs = processor(images=images, return_tensors="pt").to(device)

    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    embeddings = [feat.cpu().tolist() for feat in image_features]
    return jsonify({'embeddings': embeddings, 'count': len(embeddings)})
```

### 3. 画像のリサイズ

```typescript
import sharp from 'sharp';

// 大きな画像をリサイズ (CLIP入力は224x224または336x336)
const resizedBuffer = await sharp(imageBuffer)
  .resize(336, 336, { fit: 'cover' })
  .jpeg({ quality: 90 })
  .toBuffer();

const embedding = await generateEmbeddingLocal(resizedBuffer);
```

---

## クラウドデプロイ

### AWS EC2 + GPU

```bash
# p3.2xlarge インスタンス (V100 GPU)
# Ubuntu 22.04 + CUDA 11.8

# CUDA環境のセットアップ
sudo apt update
sudo apt install python3-pip python3-venv
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-ubuntu2204.pin
sudo mv cuda-ubuntu2204.pin /etc/apt/preferences.d/cuda-repository-pin-600
sudo apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/3bf863cc.pub
sudo add-apt-repository "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/ /"
sudo apt update
sudo apt install cuda

# CLIPサーバーのデプロイ
git clone https://github.com/your-repo/OpenWardrobeMarket.git
cd OpenWardrobeMarket/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# サービス化
sudo tee /etc/systemd/system/clip-server.service > /dev/null <<EOF
[Unit]
Description=CLIP Embedding Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/OpenWardrobeMarket/server
Environment="PATH=/home/ubuntu/OpenWardrobeMarket/server/venv/bin"
ExecStart=/home/ubuntu/OpenWardrobeMarket/server/venv/bin/python clip-server.py --model vit-l-14 --device cuda --host 0.0.0.0
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable clip-server
sudo systemctl start clip-server
```

### GCP Vertex AI Workbench

```bash
# NVIDIA T4 GPU インスタンス
# PyTorch pre-installed image

cd /home/jupyter
git clone https://github.com/your-repo/OpenWardrobeMarket.git
cd OpenWardrobeMarket/server
pip install -r requirements.txt

# Jupyter Notebook で実行
python clip-server.py --model vit-l-14 --device cuda --host 0.0.0.0
```

---

## トラブルシューティング

### 1. CUDA が認識されない

```python
import torch
print(torch.cuda.is_available())  # False の場合

# 解決策: CUDA版PyTorchを再インストール
pip uninstall torch torchvision
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### 2. MPS (Apple Silicon) が認識されない

```python
import torch
print(torch.backends.mps.is_available())  # False の場合

# 解決策: PyTorchを最新版に更新
pip install --upgrade torch torchvision
```

### 3. メモリ不足エラー

```python
# server/clip-server.py を修正
BATCH_SIZE = 16  # デフォルト32から減らす

@app.route('/embed/batch', methods=['POST'])
def embed_batch():
    files = request.files.getlist('images')
    all_embeddings = []

    # バッチサイズを制限
    for i in range(0, len(files), BATCH_SIZE):
        batch_files = files[i:i + BATCH_SIZE]
        # ... 処理
```

### 4. ポート5000が使用中

```bash
# 別のポートを使用
python clip-server.py --port 5001

# TypeScript側も変更
const response = await fetch('http://localhost:5001/embed', ...);
```

---

## コスト比較

### 1000枚の画像処理

| 方法 | 初期コスト | 従量課金 | 合計コスト |
|------|-----------|----------|-----------|
| Hugging Face API | $0 | $0 (制限あり) | $0 |
| Replicate API | $0 | $0.60 | $0.60 |
| **ローカル (M2 Mac)** | **$0** | **$0** | **$0** |
| AWS p3.2xlarge (1時間) | $0 | $3.06 | $3.06 |
| GCP T4 (1時間) | $0 | $0.35 | $0.35 |

### 10万枚の画像処理

| 方法 | 従量課金 | インフラコスト | 合計コスト |
|------|----------|---------------|-----------|
| Replicate API | $60 | $0 | $60 |
| AWS p3.2xlarge (3時間) | $0 | $9.18 | $9.18 |
| **GCP T4 (10時間)** | **$0** | **$3.50** | **$3.50** |
| ローカル (M2 Max) | $0 | $0 | $0 |

---

## まとめ

### セルフホストCLIPの選択基準

| 状況 | 推奨方法 | 理由 |
|------|----------|------|
| 開発・テスト (数百枚) | ローカル CPU | セットアップ不要 |
| 本番環境 (数千枚) | ローカル GPU (MPS/CUDA) | 高速・無料 |
| 大規模処理 (10万枚+) | GCP T4 GPU | コスト効率最高 |
| 継続的処理 | AWS/GCP GPU常駐 | 安定性重視 |

### 次のステップ

1. **ローカルで試す**
   ```bash
   cd server/
   python clip-server.py --model vit-b-32 --device cpu
   ```

2. **スクリプトを修正**
   - `scripts/generate-embeddings-from-catalog.ts` を更新
   - Hugging Face API → ローカルCLIP

3. **カタログ画像を処理**
   ```bash
   npm run tsx scripts/generate-embeddings-from-catalog.ts
   ```

4. **本番環境にデプロイ** (オプション)
   - GCP Vertex AI Workbench (T4 GPU)
   - AWS EC2 p3.2xlarge (V100 GPU)

---

## 参考リンク

- [CLIP Paper](https://arxiv.org/abs/2103.00020)
- [OpenAI CLIP GitHub](https://github.com/openai/CLIP)
- [Hugging Face Transformers](https://huggingface.co/docs/transformers)
- [PyTorch](https://pytorch.org/)
- [pgvector](https://github.com/pgvector/pgvector)

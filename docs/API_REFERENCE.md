# API Reference - Open Wardrobe Market

## 概要

Open Wardrobe Market は、REST API を基盤とした包括的な API セットを提供しています。すべてのエンドポイントは Next.js API Routes として実装され、Vercel のサーバーレス環境でホストされています。

## 認証

### JWT Bearer Token
```bash
Authorization: Bearer <jwt_token>
```

すべての認証が必要なエンドポイントで JWT トークンが必要です。トークンは Supabase Auth から取得します。

## エラーレスポンス

### 統一エラー形式
```json
{
  "error": "エラーメッセージ",
  "details": "詳細なエラー情報（オプション）",
  "status": 500
}
```

### HTTPステータスコード
- `200` - 成功
- `400` - リクエストエラー
- `401` - 認証エラー
- `403` - 認可エラー
- `404` - リソースが見つからない
- `405` - メソッドが許可されていない
- `500` - サーバーエラー

---

## Analytics API

### GET /api/analytics

ユーザーの分析データを取得します。

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| user_id | string | ✅ | ユーザーID |
| type | string | | 分析タイプ（デフォルト: overview） |

#### type の値
- `overview` - 全体統計
- `generation-history` - 生成履歴分析
- `style-trends` - スタイルトレンド
- `engagement` - エンゲージメント分析
- `marketplace` - マーケットプレイス分析

#### レスポンス例

```json
{
  "success": true,
  "data": {
    "totalGenerations": 42,
    "publishedItems": 8,
    "totalLikes": 156,
    "totalViews": 1240,
    "collectionsCount": 3,
    "averageLikesPerItem": "19.5",
    "averageViewsPerItem": "155.0"
  }
}
```

---

## DeepSeek Prompt API

### POST /api/deepseek-prompt

自然言語からファッションデザインプロンプトを生成します。

#### リクエストボディ

```json
{
  "input": "カジュアルで春らしいワンピースが欲しい",
  "context": {
    "vibe": "casual",
    "season": "spring",
    "colors": ["pink", "white"]
  }
}
```

#### レスポンス

```json
{
  "success": true,
  "prompt": "A casual spring dress with soft pink and white colors, flowing fabric, floral pattern, knee-length, comfortable fit for everyday wear",
  "parameters": {
    "vibe": "casual",
    "colors": ["pink", "white"],
    "tags": ["dress", "spring", "casual", "floral"]
  }
}
```

---

## Export API

### POST /api/export

高解像度画像エクスポート機能。

#### リクエストボディ

```json
{
  "item_id": "uuid",
  "user_id": "uuid",
  "format": "png",
  "quality": "high",
  "include_metadata": true,
  "batch_ids": ["uuid1", "uuid2"]
}
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| item_id | string | | 単体エクスポート用ID |
| user_id | string | ✅ | ユーザーID |
| format | string | | 出力形式（png/jpeg/webp） |
| quality | string | | 品質（ultra/high/medium/low） |
| include_metadata | boolean | | メタデータ含有フラグ |
| batch_ids | string[] | | バッチエクスポート用ID配列 |

#### レスポンス

```json
{
  "success": true,
  "item_id": "uuid",
  "filename": "owm-uuid-high.png",
  "format": "png",
  "quality": "high",
  "dimensions": {
    "width": 2000,
    "height": 3000
  },
  "size": 1234567,
  "download_url": "data:image/png;base64,..."
}
```

---

## Generation Webhook API

### POST /api/imagine-webhook

ImagineAPI からの Webhook を受信します。

#### リクエストボディ

```json
{
  "id": "generation_id",
  "status": "completed",
  "result": {
    "url": "https://example.com/generated-image.jpg",
    "width": 512,
    "height": 768
  },
  "error": null
}
```

#### レスポンス

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

## Recommendation API

### GET /api/recommend

パーソナライズされた推薦を取得します。

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| user_id | string | | ユーザーID（未指定時はトレンド） |
| type | string | | 推薦タイプ |
| limit | number | | 取得件数（デフォルト: 20） |
| item_id | string | | 類似推薦用の基準アイテムID |
| categories | string | | カテゴリフィルタ（カンマ区切り） |

#### type の値
- `personalized` - パーソナライズド推薦
- `trending` - トレンド推薦
- `similar` - 類似推薦（item_id必須）
- `new` - 新着推薦
- `category` - カテゴリ推薦（categories必須）

#### レスポンス

```json
{
  "success": true,
  "type": "personalized",
  "recommendations": [
    {
      "id": "uuid",
      "title": "Summer Casual Dress",
      "image_url": "https://...",
      "tags": ["dress", "summer", "casual"],
      "colors": ["blue", "white"],
      "likes": 24,
      "views": 180,
      "price": 8500
    }
  ],
  "total": 15
}
```

---

## Search API

### GET /api/search

高度な検索・フィルタ機能。

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| q | string | | 検索クエリ |
| tags | string | | タグフィルタ（カンマ区切り） |
| colors | string | | カラーフィルタ（カンマ区切り） |
| price_min | number | | 最小価格 |
| price_max | number | | 最大価格 |
| vibe | string | | 雰囲気フィルタ |
| user_id | string | | ユーザーID（個人アイテム検索用） |
| sort | string | | ソート順 |
| limit | number | | 取得件数 |
| offset | number | | オフセット |
| type | string | | 検索対象タイプ |

#### sort の値
- `relevance` - 関連度順
- `price_low` - 価格昇順
- `price_high` - 価格降順
- `likes` - いいね数順
- `views` - ビュー数順
- `newest` - 新着順
- `oldest` - 古い順

#### type の値
- `all` - 全体検索
- `published` - 公開アイテムのみ
- `generated` - 生成アイテムのみ

#### レスポンス

```json
{
  "success": true,
  "results": [
    {
      "id": "uuid",
      "title": "Elegant Evening Dress",
      "src": "https://...",
      "tags": ["dress", "evening", "elegant"],
      "colors": ["black", "gold"],
      "likes": 42,
      "views": 320,
      "type": "published"
    }
  ],
  "total": 156,
  "suggestions": ["dress", "elegant", "evening"],
  "query": "elegant dress",
  "filters": {
    "tags": ["dress"],
    "colors": ["black"],
    "price_range": { "min": null, "max": null },
    "vibe": "elegant"
  },
  "sort": "relevance",
  "pagination": {
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

## Share API

### POST /api/share

SNS シェア用 URL 生成。

#### リクエストボディ

```json
{
  "platform": "twitter",
  "itemId": "uuid",
  "title": "My Fashion Design",
  "description": "Created with Open Wardrobe Market",
  "imageUrl": "https://...",
  "tags": ["fashion", "design", "style"]
}
```

#### platform の値
- `twitter` - Twitter/X
- `instagram` - Instagram
- `pinterest` - Pinterest
- `facebook` - Facebook
- `line` - LINE
- `copy` - クリップボード用テキスト
- `download` - ダウンロード情報

#### レスポンス

##### Twitter の場合
```json
{
  "success": true,
  "url": "https://twitter.com/intent/tweet?text=...",
  "platform": "twitter",
  "directShare": false
}
```

##### Instagram の場合
```json
{
  "success": true,
  "platform": "instagram",
  "directShare": false,
  "instructions": {
    "step1": "Download the image",
    "step2": "Open Instagram app",
    "step3": "Create a new post with the downloaded image",
    "step4": "Use this caption: My Fashion Design #fashion #design",
    "imageUrl": "https://..."
  }
}
```

---

## User Gallery API

### GET /api/user-gallery

ユーザーのギャラリーデータを取得。

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| user_id | string | ✅ | ユーザーID |
| type | string | | ギャラリータイプ |
| limit | number | | 取得件数（デフォルト: 50） |
| offset | number | | オフセット |

#### type の値
- `all` - 全アイテム
- `generated` - 生成済みアイテム
- `published` - 公開済みアイテム
- `saved` - 保存済みアイテム

#### レスポンス

```json
{
  "success": true,
  "images": [
    {
      "id": "uuid",
      "title": "Generated Design",
      "src": "https://...",
      "r2_url": "https://...",
      "tags": ["casual", "summer"],
      "colors": ["blue", "white"],
      "width": 800,
      "height": 1200,
      "likes": 0,
      "created_at": "2024-01-15T10:30:00Z",
      "type": "generated",
      "is_published": false
    }
  ],
  "total": 42,
  "type": "all"
}
```

### DELETE /api/user-gallery

ユーザーの生成画像を削除。

#### リクエストボディ

```json
{
  "user_id": "uuid",
  "image_id": "uuid"
}
```

#### レスポンス

```json
{
  "success": true
}
```

---

## Saved API

### GET /api/saved

保存済みアイテムを取得（現在は準備中）。

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| user_id | string | ✅ | ユーザーID |

#### レスポンス

```json
{
  "success": true,
  "items": [],
  "message": "Saved items feature coming soon"
}
```

---

## レート制限

### 制限値
- 一般API: 100リクエスト/分
- 生成API: 10リクエスト/分
- エクスポートAPI: 5リクエスト/分

### レート制限ヘッダー
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## SDK・クライアント例

### JavaScript/TypeScript

```typescript
class OpenWardrobeMarketAPI {
  private baseURL = 'https://your-app.vercel.app/api';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getRecommendations(params: {
    type?: string;
    limit?: number;
    user_id?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/recommend?${queryString}`);
  }

  async search(query: string, filters: any = {}) {
    const params = { q: query, ...filters };
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/search?${queryString}`);
  }

  async generatePrompt(input: string, context: any = {}) {
    return this.request('/deepseek-prompt', {
      method: 'POST',
      body: JSON.stringify({ input, context }),
    });
  }
}

// 使用例
const api = new OpenWardrobeMarketAPI('your-jwt-token');

const recommendations = await api.getRecommendations({
  type: 'personalized',
  limit: 10
});

const searchResults = await api.search('casual dress', {
  colors: 'blue,white',
  price_max: 10000
});
```

### Python

```python
import requests
from typing import Optional, Dict, List

class OpenWardrobeMarketAPI:
    def __init__(self, token: str, base_url: str = "https://your-app.vercel.app/api"):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def _request(self, method: str, endpoint: str, **kwargs):
        response = requests.request(
            method, 
            f"{self.base_url}{endpoint}", 
            headers=self.headers, 
            **kwargs
        )
        response.raise_for_status()
        return response.json()
    
    def get_recommendations(self, type: str = "personalized", limit: int = 20, **params):
        params.update({"type": type, "limit": limit})
        return self._request("GET", "/recommend", params=params)
    
    def search(self, query: str, **filters):
        params = {"q": query, **filters}
        return self._request("GET", "/search", params=params)
    
    def generate_prompt(self, input: str, context: Optional[Dict] = None):
        data = {"input": input, "context": context or {}}
        return self._request("POST", "/deepseek-prompt", json=data)

# 使用例
api = OpenWardrobeMarketAPI("your-jwt-token")

recommendations = api.get_recommendations(type="trending", limit=10)
search_results = api.search("elegant dress", colors="black,red", price_max=15000)
prompt_result = api.generate_prompt("春らしいカジュアルな服", {"season": "spring"})
```

---

この API リファレンスは、Open Wardrobe Market の全機能への完全なアクセスを提供します。各エンドポイントは本番環境で動作確認済みです。
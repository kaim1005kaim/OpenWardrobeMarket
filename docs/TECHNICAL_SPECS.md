# Open Wardrobe Market - 技術仕様書

## システムアーキテクチャ概要

Open Wardrobe Market は、AI 駆動のファッションデザイン生成・マーケットプレイスプラットフォームです。モダンなフルスタックアーキテクチャを採用し、スケーラブルで高性能な Web アプリケーションを実現しています。

### アーキテクチャ図

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   External APIs │
│                 │    │                  │    │                 │
│ React + TS      │◄──►│ Next.js Routes   │◄──►│ DeepSeek AI     │
│ Vite + Tailwind │    │ Serverless       │    │ ImagineAPI      │
│ SSE Client      │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       │
┌─────────────────┐    ┌──────────────────┐              │
│   Vercel CDN    │    │   Database       │              │
│                 │    │                  │              │
│ Static Assets   │    │ Supabase         │              │
│ Edge Caching    │    │ PostgreSQL + RLS │              │
└─────────────────┘    └──────────────────┘              │
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   File Storage   │    │   Webhook       │
                       │                  │    │                 │
                       │ Cloudflare R2    │    │ Real-time       │
                       │ Image Storage    │    │ Generation      │
                       └──────────────────┘    └─────────────────┘
```

## フロントエンド技術スタック

### React + TypeScript
- **React 18**: 最新の Concurrent Features を活用
- **TypeScript 5.x**: 厳密な型システムによる開発効率化
- **Context API**: グローバル状態管理（認証、テーマ等）
- **Custom Hooks**: ロジック再利用とコンポーネント分離

### ビルド・開発ツール
- **Vite**: 超高速開発サーバーとビルドシステム
- **ES Modules**: ネイティブ ES モジュールサポート
- **Hot Module Replacement (HMR)**: リアルタイム開発体験
- **Tree Shaking**: 不要コードの自動削除

### スタイリング
- **Tailwind CSS**: ユーティリティファーストなCSSフレームワーク
- **Responsive Design**: モバイルファーストアプローチ
- **Lucide Icons**: 軽量で一貫性のあるアイコンシステム
- **CSS Variables**: テーマとダークモード対応

### UI/UX パターン
```typescript
// コンポーネント構造例
interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

const OptimizedComponent: React.FC<ComponentProps> = ({ className, children }) => {
  return (
    <div className={`base-styles ${className}`}>
      {children}
    </div>
  );
};
```

## バックエンド技術スタック

### Next.js API Routes
- **Serverless Functions**: 自動スケーリング対応
- **Edge Runtime**: 低遅延レスポンス
- **Middleware**: 認証・CORS・レート制限
- **Type Safety**: フロントエンドとの型共有

### API エンドポイント設計
```
/api/
├── analytics.ts          # 分析データ取得
├── deepseek-prompt.ts    # AI プロンプト生成
├── export.ts            # 高解像度エクスポート
├── imagine-webhook.ts    # 画像生成Webhook
├── recommend.ts         # レコメンデーション
├── saved.ts             # 保存済みアイテム
├── search.ts            # 検索・フィルタ
├── share.ts             # SNSシェア
└── user-gallery.ts      # ユーザーギャラリー
```

### エラーハンドリング
```typescript
// 統一エラーレスポンス形式
interface APIError {
  error: string;
  details?: string;
  status?: number;
}

// 包括的エラーハンドリング
try {
  const result = await processRequest(req);
  res.status(200).json({ success: true, data: result });
} catch (error) {
  console.error('[API] Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

## データベース設計

### Supabase PostgreSQL + RLS
- **Row Level Security**: ユーザーごとのデータアクセス制御
- **JWT Authentication**: セッション管理とセキュリティ
- **Real-time Subscriptions**: データ変更の即座反映
- **Materialized Views**: 分析クエリの高速化

### テーブル設計

#### generation_history (生成履歴)
```sql
CREATE TABLE generation_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id),
    prompt text,
    generation_data jsonb,
    images jsonb,
    r2_url text,
    created_at timestamp DEFAULT now()
);

-- RLS Policy
CREATE POLICY "Users can access own generations" ON generation_history
    FOR ALL USING (auth.uid() = user_id);
```

#### published_items (公開アイテム)
```sql
CREATE TABLE published_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id),
    title text NOT NULL,
    description text,
    image_url text,
    tags text[],
    colors text[],
    price integer,
    likes integer DEFAULT 0,
    views integer DEFAULT 0,
    is_public boolean DEFAULT true,
    status text DEFAULT 'active',
    metadata jsonb,
    created_at timestamp DEFAULT now()
);

-- インデックス最適化
CREATE INDEX idx_published_items_likes ON published_items(likes DESC);
CREATE INDEX idx_published_items_created_at ON published_items(created_at DESC);
CREATE INDEX idx_published_items_tags ON published_items USING GIN(tags);
```

#### collections (コレクション)
```sql
CREATE TABLE collections (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id),
    name text NOT NULL,
    description text,
    item_ids uuid[],
    is_private boolean DEFAULT false,
    created_at timestamp DEFAULT now()
);
```

### マテリアライズドビュー
```sql
-- 分析用高速クエリ
CREATE MATERIALIZED VIEW user_analytics_summary AS
SELECT 
    user_id,
    COUNT(*) as total_generations,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_generations,
    AVG(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as weekly_activity
FROM generation_history
GROUP BY user_id;

-- 定期的なリフレッシュ
CREATE OR REPLACE FUNCTION refresh_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_analytics_summary;
END;
$$ LANGUAGE plpgsql;
```

## AI統合アーキテクチャ

### DeepSeek AI プロンプト生成
```typescript
interface DeepSeekRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

const generatePrompt = async (userInput: string): Promise<string> => {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: FASHION_DESIGN_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userInput
        }
      ],
      temperature: 0.8,
      max_tokens: 150
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
};
```

### ImagineAPI 画像生成
```typescript
interface ImagineAPIConfig {
  prompt: string;
  style?: string;
  aspect_ratio?: string;
  webhookUrl?: string;
}

const generateImage = async (config: ImagineAPIConfig) => {
  const response = await fetch('https://api.imagineapi.dev/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.IMAGINEAPI_BEARER}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: config.prompt,
      style: config.style || 'photographic',
      aspect_ratio: config.aspect_ratio || '3:4',
      webhook: config.webhookUrl
    })
  });
  
  return await response.json();
};
```

## リアルタイム通信

### Server-Sent Events (SSE)
```typescript
// フロントエンド: SSE接続
const useGeneration = (taskId: string) => {
  const [status, setStatus] = useState<string>('pending');
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/generation-status?task=${taskId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus(data.status);
      
      if (data.status === 'completed') {
        eventSource.close();
      }
    };
    
    return () => eventSource.close();
  }, [taskId]);
  
  return { status };
};
```

### Webhook 処理
```typescript
// バックエンド: Webhook受信
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  
  const { status, task_id, result } = req.body;
  
  // データベース更新
  await supabase
    .from('generation_tasks')
    .update({ 
      status, 
      result,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .eq('task_id', task_id);
    
  res.status(200).json({ success: true });
}
```

## ストレージアーキテクチャ

### Cloudflare R2 統合
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const uploadToR2 = async (buffer: Buffer, key: string): Promise<string> => {
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    Metadata: {
      'uploaded-by': 'open-wardrobe-market'
    }
  }));
  
  return `${process.env.R2_PUBLIC_URL}/${key}`;
};
```

## パフォーマンス最適化

### フロントエンド最適化
- **Code Splitting**: ルート単位での自動分割
- **Lazy Loading**: 画像・コンポーネントの遅延読み込み
- **Memoization**: React.memo, useMemo, useCallback活用
- **Virtual Scrolling**: 大量データの効率的表示

### バックエンド最適化
```typescript
// データベースクエリ最適化
const getRecommendations = async (userId: string, limit: number) => {
  // インデックス活用クエリ
  const { data } = await supabase
    .from('published_items')
    .select(`
      id, title, image_url, tags, likes, views,
      user_profiles!inner (
        id, avatar_url, display_name
      )
    `)
    .eq('is_public', true)
    .neq('user_id', userId)
    .order('likes', { ascending: false })
    .limit(limit);
    
  return data;
};

// レスポンス時間最適化
const cache = new Map();
const getCachedData = async (key: string, fetchFn: () => Promise<any>) => {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = await fetchFn();
  cache.set(key, data);
  
  // 5分でキャッシュ無効化
  setTimeout(() => cache.delete(key), 5 * 60 * 1000);
  
  return data;
};
```

## セキュリティ対策

### 認証・認可
```typescript
// JWT検証ミドルウェア
const verifyAuth = async (req: NextApiRequest): Promise<User | null> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) return null;
  
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
};

// API保護
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await verifyAuth(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // 処理続行...
}
```

### データバリデーション
```typescript
import { z } from 'zod';

const GenerationSchema = z.object({
  prompt: z.string().min(1).max(500),
  style: z.enum(['casual', 'elegant', 'bohemian']),
  colors: z.array(z.string()).max(3),
  tags: z.array(z.string()).max(10)
});

export const validateGenerationRequest = (data: unknown) => {
  return GenerationSchema.parse(data);
};
```

## 監視・ログ

### エラー追跡
```typescript
// 構造化ログ
const logger = {
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

### パフォーマンス監視
```typescript
// APIレスポンス時間計測
const withTiming = (handler: NextApiHandler): NextApiHandler => {
  return async (req, res) => {
    const start = Date.now();
    
    try {
      await handler(req, res);
    } finally {
      const duration = Date.now() - start;
      
      logger.info('API Request', {
        method: req.method,
        url: req.url,
        duration,
        status: res.statusCode
      });
    }
  };
};
```

## デプロイメント戦略

### 環境構成
```bash
# 開発環境
ENVIRONMENT=development
LOG_LEVEL=debug

# ステージング環境
ENVIRONMENT=staging
LOG_LEVEL=info

# 本番環境
ENVIRONMENT=production
LOG_LEVEL=error
```

### CI/CD パイプライン
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build
      - run: npm run test
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## スケーラビリティ考慮事項

### 水平スケーリング
- **Serverless Functions**: 自動スケーリング対応
- **Database Connection Pooling**: 接続効率化
- **CDN**: 静的アセットの地理的分散
- **Caching Strategy**: Redis/Memcached統合準備

### 将来的な拡張
- **Microservices化**: サービス分離とAPI Gateway導入
- **Event-Driven Architecture**: 非同期処理とメッセージキュー
- **Multi-Region Deployment**: 地理的冗長化
- **AI Model Self-Hosting**: 独自AI基盤構築

---

この技術仕様書は、Open Wardrobe Market の技術的な実装詳細を包括的に文書化しています。システムの理解と今後の拡張・保守作業に活用してください。
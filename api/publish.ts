import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Functionでは VITE_ プレフィックスは使えない
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

console.log('[Publish Init] Supabase URL:', supabaseUrl ? 'configured' : 'MISSING');
console.log('[Publish Init] Supabase Key:', supabaseAnonKey ? 'configured' : 'MISSING');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - 公開アイテム一覧を取得
  if (req.method === 'GET') {
    try {
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;

      const { data, error } = await supabase
        .from('published_items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        items: data,
        count: data.length
      });
    } catch (error) {
      console.error('[Publish GET] Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    asset_id,
    user_id,
    title,
    description,
    tags,
    price,
    image_url,
    posterUrl,
    originalUrl,
    saleType,
    category
  } = req.body;

  // バリデーション
  if (!title || !category || !posterUrl || !originalUrl) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['title', 'category', 'posterUrl', 'originalUrl']
    });
  }

  if (price < 1000 || price > 100000) {
    return res.status(400).json({ error: 'Price must be between ¥1,000 and ¥100,000' });
  }

  if (tags && tags.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 tags allowed' });
  }

  try {
    console.log('[Publish] Publishing asset:', {
      asset_id,
      user_id,
      title,
      price,
      tags: tags?.length || 0
    });

    // 出品データの作成
    const publishedAsset = {
      id: `published-${asset_id}`,
      original_asset_id: asset_id,
      user_id,
      title: title.trim(),
      description: description?.trim() || '',
      tags: tags || [],
      price: Math.round(price),
      image_url,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      views: 0,
      likes: 0,
      purchases: 0,
      is_featured: false,
      // 追加メタデータ
      metadata: {
        source: 'ai_generated',
        published_from: 'app',
        original_prompt: req.body.original_prompt || null,
        generation_params: req.body.generation_params || null
      }
    };

    // データベースに出品情報を保存
    const { data: publishData, error: publishError } = await supabase
      .from('published_items')
      .insert({
        user_id: user_id || null,
        image_id: asset_id || null,
        title: title.trim(),
        description: description?.trim() || '',
        price: Math.round(price || 0),
        tags: tags || [],
        category: category,
        poster_url: posterUrl,
        original_url: originalUrl,
        sale_type: saleType || 'buyout',
        is_active: true
      })
      .select()
      .single();

    if (publishError) {
      console.error('[Publish] Database insert error:', publishError);
      throw publishError;
    }

    // 画像テーブルの公開状態を更新
    await supabase
      .from('images')
      .update({ 
        is_published: true,
        published_item_id: publishData.id 
      })
      .eq('id', asset_id);

    // 成功レスポンス
    console.log('[Publish] Successfully published:', publishedAsset.id);
    
    res.status(200).json({
      success: true,
      asset: {
        id: publishData.id,
        original_asset_id: asset_id,
        user_id,
        title: publishData.title,
        description: publishData.description,
        tags: publishData.tags,
        price: publishData.price,
        image_url,
        status: publishData.status,
        created_at: publishData.created_at,
        metadata: publishData.metadata
      },
      message: '作品が正常に出品されました！',
      share_url: `${req.headers.origin || 'https://your-domain.com'}/item/${publishData.id}`
    });

    // 非同期でメタデータを更新
    updatePublishMetrics(user_id, publishData);

  } catch (error) {
    console.error('[Publish] Error:', error);
    console.error('[Publish] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[Publish] Supabase URL configured:', !!supabaseUrl);
    console.error('[Publish] Supabase Key configured:', !!supabaseAnonKey);

    res.status(500).json({
      error: 'Publication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

async function updatePublishMetrics(userId: string, asset: any) {
  try {
    // ユーザー統計の更新
    await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        total_items: supabase.rpc('increment_user_items', { user_id: userId, count: 1 }),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    // 出品済み画像の統計を更新
    await supabase
      .from('images')
      .update({
        likes: supabase.rpc('get_image_likes', { image_id: asset.image_id })
      })
      .eq('id', asset.image_id);

    console.log('[Publish] Updated metrics for user:', userId);
  } catch (error) {
    console.error('[Publish] Metrics update failed:', error);
  }
}

// 将来の機能: 自動タグ提案
async function suggestAdditionalTags(asset: any): Promise<string[]> {
  // TODO: 画像解析ベースの追加タグ提案
  // - CLIP embeddings
  // - 既存作品との類似性
  // - トレンド分析
  
  return [];
}

// 将来の機能: 重複チェック
async function checkForDuplicates(imageUrl: string, userId: string): Promise<boolean> {
  // TODO: 重複画像の検出
  // - 画像ハッシュ比較
  // - ユーザー履歴チェック
  
  return false;
}

// 将来の機能: コンテンツモデレーション
async function moderateContent(asset: any): Promise<{ approved: boolean; reasons?: string[] }> {
  // TODO: 自動コンテンツチェック
  // - 不適切な内容の検出
  // - 著作権侵害チェック
  // - 品質基準チェック
  
  return { approved: true };
}
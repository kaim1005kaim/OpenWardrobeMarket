import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../src/app/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    image_url
  } = req.body;

  // バリデーション
  if (!asset_id || !user_id || !title || !price || !image_url) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['asset_id', 'user_id', 'title', 'price', 'image_url']
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
        user_id,
        image_id: asset_id,
        title: title.trim(),
        description: description?.trim() || '',
        price: Math.round(price),
        tags: tags || [],
        status: 'active',
        metadata: {
          source: 'ai_generated',
          published_from: 'app',
          original_prompt: req.body.original_prompt || null,
          generation_params: req.body.generation_params || null
        }
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
    res.status(500).json({ 
      error: 'Publication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
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
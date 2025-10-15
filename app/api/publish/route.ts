export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 50;
    const offset = Number(searchParams.get('offset')) || 0;

    const { data, error } = await supabase
      .from('published_items')
      .select(
        `
          *,
          user_profiles(username, avatar_url)
        `
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Publish GET] Supabase error:', error);
      throw error;
    }

    const itemsWithUsername =
      data?.map((item: any) => ({
        ...item,
        username: item.user_profiles?.username || 'Anonymous',
        avatar_url: item.user_profiles?.avatar_url || null,
        user_profiles: undefined
      })) ?? [];

    return new Response(
      JSON.stringify({
        success: true,
        items: itemsWithUsername,
        count: itemsWithUsername.length
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Publish GET] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: corsHeaders
      });
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
    } = body;

    if (!title || !category || !posterUrl || !originalUrl) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['title', 'category', 'posterUrl', 'originalUrl']
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (price < 1000 || price > 100000) {
      return new Response(JSON.stringify({ error: 'Price must be between ¥1,000 and ¥100,000' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (tags && tags.length > 10) {
      return new Response(JSON.stringify({ error: 'Maximum 10 tags allowed' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const publishedAsset = {
      id: `published-${asset_id}`,
      original_asset_id: asset_id,
      user_id,
      title: title.trim(),
      description: description?.trim() || '',
      tags: tags || [],
      category,
      sale_type: saleType || 'buyout',
      price: Math.round(price || 0)
    };

    const { data: publishData, error: publishError } = await supabase
      .from('published_items')
      .insert({
        user_id: user_id || null,
        image_id: asset_id || null,
        title: title.trim(),
        description: description?.trim() || '',
        price: Math.round(price || 0),
        tags: tags || [],
        category,
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

    await supabase
      .from('images')
      .update({
        is_published: true,
        published_item_id: publishData.id
      })
      .eq('id', asset_id);

    const origin = request.headers.get('origin') || 'https://your-domain.com';

    updatePublishMetrics(user_id, publishData).catch((err) =>
      console.error('[Publish] Metrics update failed:', err)
    );

    return new Response(
      JSON.stringify({
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
        share_url: `${origin}/item/${publishData.id}`
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Publish] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Publication failed',
        details: error?.message || 'Unknown error',
        stack: error?.stack
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function updatePublishMetrics(userId: string, asset: any) {
  try {
    await supabase
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    await supabase
      .from('images')
      .update({
        likes: asset.likes || 0
      })
      .eq('id', asset.image_id);

    console.log('[Publish] Updated metrics for user:', userId);
  } catch (error) {
    console.error('[Publish] Metrics update failed:', error);
  }
}

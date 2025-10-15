export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const type = searchParams.get('type') ?? 'all';
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'user_id is required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    let data: any[] = [];
    let count = 0;

    if (type === 'generated' || type === 'all') {
      const result = await supabase
        .from('generation_history')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (result.error) {
        console.error('Error fetching generation history:', result.error);
      } else {
        const generatedItems = (result.data || []).map((item) => ({
          id: item.id,
          title: item.generation_data?.title || 'Generated Design',
          src: item.images?.[0]?.url || item.r2_url || '',
          r2_url: item.r2_url,
          tags: item.generation_data?.parameters?.tags || [],
          colors: item.generation_data?.parameters?.colors || [],
          width: 800,
          height: 1200,
          likes: 0,
          created_at: item.created_at,
          type: 'generated',
          is_published: false,
          original_prompt: item.prompt,
          generation_params: item.generation_data?.parameters || {},
          images: item.images || []
        }));
        data = [...data, ...generatedItems];
        count += result.count || 0;
      }
    }

    if (type === 'published' || type === 'all') {
      const result = await supabase
        .from('published_items')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (result.error) {
        console.error('Error fetching published items:', result.error);
      } else {
        const publishedItems = (result.data || []).map((item) => ({
          id: item.id,
          title: item.title,
          src: item.image_url || '',
          r2_url: item.image_url,
          tags: item.tags || [],
          colors: item.colors || [],
          width: item.metadata?.width || 800,
          height: item.metadata?.height || 1200,
          likes: item.likes || 0,
          views: item.views || 0,
          created_at: item.created_at,
          type: 'published',
          is_published: true,
          price: item.price,
          status: item.status,
          description: item.description
        }));

        if (type === 'all') {
          publishedItems.forEach((item) => {
            if (!data.find((d) => d.id === item.id)) {
              data.push(item);
            }
          });
        } else {
          data = publishedItems;
        }

        if (type === 'published') {
          count = result.count || 0;
        }
      }
    }

    if (type === 'saved') {
      const result = await supabase
        .from('collections')
        .select(`*, published_items (*)`, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (result.error) {
        console.error('Error fetching saved items:', result.error);
      } else {
        const savedItems = (result.data || []).flatMap((collection) =>
          (collection.published_items || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            src: item.image_url || '',
            r2_url: item.image_url,
            tags: item.tags || [],
            colors: item.colors || [],
            width: item.metadata?.width || 800,
            height: item.metadata?.height || 1200,
            likes: item.likes || 0,
            created_at: item.created_at,
            type: 'saved',
            saved_at: collection.created_at,
            collection_name: collection.name
          }))
        );
        data = savedItems;
        count = savedItems.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, images: data, total: count, type }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error fetching user gallery:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch gallery', details: error?.message || 'Unknown error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const { user_id, image_id } = body;

  if (!user_id || !image_id) {
    return new Response(JSON.stringify({ error: 'user_id and image_id are required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { data: imageData, error: fetchError } = await supabase
      .from('generation_history')
      .select('user_id')
      .eq('id', image_id)
      .single();

    if (fetchError || !imageData) {
      return new Response(JSON.stringify({ error: 'Image not found' }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (imageData.user_id !== user_id) {
      return new Response(JSON.stringify({ error: 'Not authorized to delete this image' }), {
        status: 403,
        headers: corsHeaders
      });
    }

    const { error: deleteError } = await supabase
      .from('generation_history')
      .delete()
      .eq('id', image_id)
      .eq('user_id', user_id);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete image', details: error?.message || 'Unknown error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

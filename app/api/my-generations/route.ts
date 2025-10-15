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
  'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'user_id parameter required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { data, error } = await supabase
      .from('user_generations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[My Generations] Query error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch generations' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true, generations: data || [] }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[My Generations] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const id = searchParams.get('id');

  if (!userId || !id) {
    return new Response(JSON.stringify({ error: 'user_id and id are required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { error } = await supabase
      .from('user_generations')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[My Generations] Delete error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete generation' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[My Generations] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const id = searchParams.get('id');

  if (!userId || !id) {
    return new Response(JSON.stringify({ error: 'user_id and id are required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const body = await request.json().catch(() => ({}));
  const { title, is_public } = body ?? {};

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (is_public !== undefined) updates.is_public = is_public;

  try {
    const { error } = await supabase
      .from('user_generations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[My Generations] Update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update generation' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('[My Generations] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

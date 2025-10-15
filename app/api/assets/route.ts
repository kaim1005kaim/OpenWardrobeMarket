import { NextResponse } from 'next/server';
import { getAuthUser, getServiceSupabase, serializeAsset, SerializedAssetOptions } from '../_shared/assets';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get('scope');
    const kind = searchParams.get('kind');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('generation_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (kind) {
      query = query.eq('kind', kind);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const serializedAssets = await Promise.all(
      data.map(async (asset) => {
        const options: SerializedAssetOptions = {};
        // Add any additional options needed for serialization, e.g., liked status
        return serializeAsset(asset, options);
      })
    );

    return NextResponse.json(serializedAssets);

  } catch (error: any) {
    console.error('Error in GET /api/assets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
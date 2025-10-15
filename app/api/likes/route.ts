export const runtime = 'nodejs';
export const revalidate = 0;

import { getAuthUser, getServiceSupabase, serializeAsset } from '../_shared/assets';

export async function GET(request: Request) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  try {
    const { data: likesData, error: likesError } = await supabase
      .from('likes')
      .select('*')
      .eq('user_id', user.id);

    if (likesError) {
      console.error('[api/likes] Failed to load likes:', likesError.message);
      return Response.json({ error: 'Failed to load likes' }, { status: 500 });
    }

    if (!likesData || likesData.length === 0) {
      return Response.json({ assets: [] });
    }

    const assetIds = likesData
      .map((like) => (like as any).asset_id || (like as any).image_id)
      .filter(Boolean);

    if (assetIds.length === 0) {
      return Response.json({ assets: [] });
    }

    const { data: assetsData, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .in('id', assetIds)
      .order('created_at', { ascending: false });

    if (assetsError) {
      console.error('[api/likes] Failed to load assets:', assetsError.message);
      return Response.json({ error: 'Failed to load liked assets' }, { status: 500 });
    }

    const likedIds = new Set(assetIds);

    const assets = await Promise.all(
      (assetsData || []).map((row) =>
        serializeAsset(row, {
          kind: 'final',
          includeRaw: true,
          likedIds
        })
      )
    );

    return Response.json({ assets });
  } catch (error: any) {
    console.error('[api/likes] GET error:', error);
    return Response.json(
      { error: 'Unexpected error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUser, getServiceSupabase, serializeAsset } from '../_shared/assets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user } = await getAuthUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getServiceSupabase();

  try {
    const { data: likesData, error: likesError } = await supabase
      .from('likes')
      .select('*')
      .eq('user_id', user.id);

    if (likesError) {
      console.error('[api/likes] Failed to load likes:', likesError.message);
      return res.status(500).json({ error: 'Failed to load likes' });
    }

    if (!likesData || likesData.length === 0) {
      return res.status(200).json({ assets: [] });
    }

    const assetIds = likesData
      .map((like) => (like as any).asset_id || (like as any).image_id)
      .filter(Boolean);

    if (assetIds.length === 0) {
      return res.status(200).json({ assets: [] });
    }

    const { data: assetsData, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .in('id', assetIds)
      .order('created_at', { ascending: false });

    if (assetsError) {
      console.error('[api/likes] Failed to load assets:', assetsError.message);
      return res.status(500).json({ error: 'Failed to load liked assets' });
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

    return res.status(200).json({ assets });
  } catch (error: any) {
    console.error('[api/likes] GET error:', error);
    return res.status(500).json({ error: 'Unexpected error', details: error?.message });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUser, getServiceSupabase } from '../lib/assets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { assetId }
  } = req;

  if (!assetId || typeof assetId !== 'string') {
    return res.status(400).json({ error: 'assetId is required' });
  }

  const { user } = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getServiceSupabase();

  if (req.method === 'POST') {
    try {
      const { error } = await supabase
        .from('likes')
        .upsert(
          {
            user_id: user.id,
            asset_id: assetId
          },
          { onConflict: 'user_id,asset_id' }
        );

      if (error) {
        console.error('[api/likes] upsert error:', error.message);
        return res.status(500).json({ error: 'Failed to like asset' });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[api/likes] POST error:', error);
      return res.status(500).json({ error: 'Unexpected error', details: error?.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('likes')
        .delete()
        .match({ user_id: user.id, asset_id: assetId });

      if (error) {
        console.error('[api/likes] delete error:', error.message);
        return res.status(500).json({ error: 'Failed to unlike asset' });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[api/likes] DELETE error:', error);
      return res.status(500).json({ error: 'Unexpected error', details: error?.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

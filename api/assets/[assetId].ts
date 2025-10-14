import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUser, getServiceSupabase, serializeAsset } from './shared.js';

const ALLOWED_STATUSES = new Set(['public', 'private', 'delisted']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { assetId }
  } = req;

  if (!assetId || typeof assetId !== 'string') {
    return res.status(400).json({ error: 'assetId is required' });
  }

  const supabase = getServiceSupabase();

  if (req.method === 'PATCH') {
    try {
      const { user } = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { status } = req.body ?? {};

      if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      const { data: existing, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      if (existing.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { data: updated, error: updateError } = await supabase
        .from('assets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', assetId)
        .select('*')
        .single();

      if (updateError || !updated) {
        console.error('[api/assets/[id]] Update error:', updateError?.message);
        return res.status(500).json({ error: 'Failed to update asset status' });
      }

      const serialized = await serializeAsset(updated, {
        kind: 'final',
        includeRaw: true
      });

      return res.status(200).json({ asset: serialized });
    } catch (error: any) {
      console.error('[api/assets/[id]] PATCH error:', error);
      return res.status(500).json({ error: 'Unexpected error', details: error?.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { user } = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: existing, error: fetchError } = await supabase
        .from('assets')
        .select('id, user_id')
        .eq('id', assetId)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      if (existing.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error: deleteError } = await supabase
        .from('assets')
        .update({ status: 'delisted', updated_at: new Date().toISOString() })
        .eq('id', assetId);

      if (deleteError) {
        console.error('[api/assets/[id]] Delete error:', deleteError.message);
        return res.status(500).json({ error: 'Failed to delete asset' });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[api/assets/[id]] DELETE error:', error);
      return res.status(500).json({ error: 'Unexpected error', details: error?.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      const serialized = await serializeAsset(data, {
        kind: 'final',
        includeRaw: true
      });

      return res.status(200).json({ asset: serialized });
    } catch (error: any) {
      console.error('[api/assets/[id]] GET error:', error);
      return res.status(500).json({ error: 'Unexpected error', details: error?.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

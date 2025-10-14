import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getAuthUser,
  getServiceSupabase,
  serializeAsset,
  assetIsAllowed,
  type SerializedAsset,
  type SerializedAssetOptions
} from '../_shared/assets';

const FALLBACK_PREFIXES = ['catalog/'];

async function fetchCatalogFallback(): Promise<SerializedAsset[]> {
  const origin =
    process.env.INTERNAL_CATALOG_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    process.env.SITE_URL ||
    'https://open-wardrobe-market.com';

  try {
    const response = await fetch(`${origin.replace(/\/$/, '')}/api/catalog`);
    if (!response.ok) {
      console.error('[api/assets] catalog fallback failed:', response.statusText);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data?.images)) {
      return [];
    }

    return data.images.map((item: any) => ({
      id: item.id || item.src,
      userId: null,
      title: item.title || 'Catalog Design',
      status: 'public' as const,
      tags: item.tags || [],
      price: item.price ?? null,
      likes: item.likes ?? 0,
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
      src: item.src,
      finalUrl: item.src,
      rawUrl: null,
      finalKey: item.key || item.src,
      rawKey: null,
      metadata: null,
      coverColor: item.dominant_color || null,
      isLiked: false
    }));
  } catch (error) {
    console.error('[api/assets] catalog fallback error:', error);
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || 'unset';
    console.log('[api/assets] R2_PUBLIC_BASE_URL', publicBaseUrl.slice(0, 24), '…');

    const { scope = 'public', kind = 'final', limit = '30', cursor } = req.query;

    const kindParam = kind === 'raw' ? 'raw' : 'final';
    const limitValue = Math.min(Number(limit) || 30, 100);

    const supabase = getServiceSupabase();

    const { user } = await getAuthUser(req);

    if (scope === 'mine' && !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let query = supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitValue);

    if (scope === 'public') {
      query = query.eq('status', 'public');
    } else if (scope === 'mine') {
      query = query.eq('user_id', user!.id);
    } else if (scope === 'liked' && user) {
      // handled after fetching likes
    }

    if (cursor && typeof cursor === 'string') {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[api/assets] Supabase error:', error);
      if ((error as any).code === '42P01' && scope === 'public') {
    const fallback = scope === 'public' ? await fetchCatalogFallback() : [];
        return res.status(200).json({ assets: fallback, cursor: null });
      }
      if (scope === 'public') {
        const fallback = await fetchCatalogFallback();
        if (fallback.length > 0) {
          return res.status(200).json({ assets: fallback, cursor: null });
        }
      }
      return res.status(500).json({ error: 'Failed to fetch assets', details: error.message });
    }

    if (!data || data.length === 0) {
      if (scope === 'public') {
        const fallback = await fetchCatalogFallback();
        return res.status(200).json({ assets: fallback, cursor: null });
      }
      return res.status(200).json({ assets: [], cursor: null });
    }

    let filtered = data.filter(assetIsAllowed);

    if (filtered.length === 0 && scope === 'public') {
      const fallback = await fetchCatalogFallback();
      return res.status(200).json({ assets: fallback, cursor: null });
    }

    // Determine liked asset ids for current user
    let likedIds = new Set<string>();

    if (user) {
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', user.id);

      if (likesError) {
        console.warn('[api/assets] Failed to load likes:', likesError.message);
      } else if (likesData) {
        for (const like of likesData) {
          const assetId = (like as any).asset_id || (like as any).image_id;
          if (assetId) likedIds.add(assetId);
        }
      }

      if (scope === 'liked') {
        const likedArray = Array.from(likedIds);
        if (likedArray.length === 0) {
          return res.status(200).json({ assets: [], cursor: null });
        }

        const { data: likedAssets, error: likedAssetsError } = await supabase
          .from('assets')
          .select('*')
          .in('id', likedArray)
          .order('created_at', { ascending: false })
          .limit(limitValue);

        if (likedAssetsError) {
          console.error('[api/assets] Failed to fetch liked assets:', likedAssetsError.message);
          if ((likedAssetsError as any).code === '42P01') {
            return res.status(200).json({ assets: [], cursor: null });
          }
          return res.status(500).json({ error: 'Failed to fetch liked assets' });
        }

        const filteredLiked = (likedAssets || []).filter(assetIsAllowed);

        if (filteredLiked.length === 0) {
          return res.status(200).json({ assets: [], cursor: null });
        }

        const serializedLiked = await Promise.all(
          filteredLiked.map((row) =>
            serializeAsset(row, { kind: kindParam, includeRaw: kindParam === 'raw', likedIds })
          )
        );

        const tail = filteredLiked.length > 0 ? filteredLiked[filteredLiked.length - 1] : null;

        return res.status(200).json({
          assets: serializedLiked,
          cursor: tail ? tail.created_at ?? null : null
        });
      }
    }

    const serializerOptions: SerializedAssetOptions = {
      kind: kindParam,
      includeRaw: kindParam === 'raw',
      likedIds
    };

    const assets: SerializedAsset[] = await Promise.all(
      filtered.map((row) => serializeAsset(row, serializerOptions))
    );

    const tail = filtered.length === 0 ? null : filtered[filtered.length - 1];
    const nextCursor = filtered.length === limitValue ? tail?.created_at ?? null : null;

    return res.status(200).json({
      assets,
      cursor: nextCursor
    });
  } catch (error: any) {
    console.error('[api/assets] Unexpected error:', error);
    return res.status(500).json({
      error: 'Unexpected error',
      details: error?.message || 'Unknown error'
    });
  }
}

export const runtime = 'nodejs';
export const revalidate = 0;

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

export async function GET(request: Request) {
  console.log(`[api/assets] Handler started. Method: ${request.method}, URL: ${request.url}`);

  try {
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || 'unset';
    console.log('[api/assets] R2_PUBLIC_BASE_URL', publicBaseUrl.slice(0, 24), '…');

    const { searchParams } = new URL(request.url);

    const scope = (searchParams.get('scope') ?? 'public') as 'public' | 'mine' | 'liked';
    const kind = searchParams.get('kind') === 'raw' ? 'raw' : 'final';
    const limitParam = Number(searchParams.get('limit')) || 30;
    const limitValue = Math.min(limitParam, 100);
    const cursor = searchParams.get('cursor');

    const supabase = getServiceSupabase();
    const { user } = await getAuthUser(request);

    if (scope === 'mine' && !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[api/assets] Supabase error:', error);
      if ((error as any).code === '42P01' && scope === 'public') {
        const fallback = scope === 'public' ? await fetchCatalogFallback() : [];
        return Response.json({ assets: fallback, cursor: null });
      }
      if (scope === 'public') {
        const fallback = await fetchCatalogFallback();
        if (fallback.length > 0) {
          return Response.json({ assets: fallback, cursor: null });
        }
      }
      return Response.json(
        { error: 'Failed to fetch assets', details: (error as any).message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      if (scope === 'public') {
        const fallback = await fetchCatalogFallback();
        return Response.json({ assets: fallback, cursor: null });
      }
      return Response.json({ assets: [], cursor: null });
    }

    let filtered = data.filter(assetIsAllowed);

    if (filtered.length === 0 && scope === 'public') {
      const fallback = await fetchCatalogFallback();
      return Response.json({ assets: fallback, cursor: null });
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
          return Response.json({ assets: [], cursor: null });
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
            return Response.json({ assets: [], cursor: null });
          }
          return Response.json({ error: 'Failed to fetch liked assets' }, { status: 500 });
        }

        const filteredLiked = (likedAssets || []).filter(assetIsAllowed);

        if (filteredLiked.length === 0) {
          return Response.json({ assets: [], cursor: null });
        }

        const serializedLiked = await Promise.all(
          filteredLiked.map((row) =>
            serializeAsset(row, { kind, includeRaw: kind === 'raw', likedIds })
          )
        );

        const tail = filteredLiked.length > 0 ? filteredLiked[filteredLiked.length - 1] : null;

        return Response.json({
          assets: serializedLiked,
          cursor: tail ? tail.created_at ?? null : null
        });
      }
    }

    const serializerOptions: SerializedAssetOptions = {
      kind,
      includeRaw: kind === 'raw',
      likedIds
    };

    const assets = await Promise.all(filtered.map((row) => serializeAsset(row, serializerOptions)));

    const tail = filtered.length === 0 ? null : filtered[filtered.length - 1];
    const nextCursor = filtered.length === limitValue ? tail?.created_at ?? null : null;

    return Response.json({
      assets,
      cursor: nextCursor
    });
  } catch (error: any) {
    console.error('!!!!!!!!!!!!!! [FATAL ERROR in /api/assets] !!!!!!!!!!!!!!');
    console.error('Error Name:', error?.name);
    console.error('Error Message:', error?.message);
    console.error('Error Stack:', error?.stack);
    try {
      console.error('Full Error Object:', JSON.stringify(error, null, 2));
    } catch {
      console.error('Full Error Object: [unserializable]');
    }

    return Response.json(
      {
        error: 'Internal Server Error',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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

    let data: any[] = [];
    let error: any = null;

    // For public scope, fetch from both assets and published_items
    if (scope === 'public') {
      // Fetch from assets table
      let assetsQuery = supabase
        .from('assets')
        .select('*')
        .eq('status', 'public')
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (cursor) {
        assetsQuery = assetsQuery.lt('created_at', cursor);
      }

      const { data: assetsData, error: assetsError } = await assetsQuery;

      // Fetch from published_items table (no join needed, image_id is now TEXT)
      let publishedQuery = supabase
        .from('published_items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (cursor) {
        publishedQuery = publishedQuery.lt('created_at', cursor);
      }

      const { data: publishedData, error: publishedError } = await publishedQuery;

      console.log('[api/assets] Published items count:', publishedData?.length || 0);

      // Convert published_items to asset format
      const publishedAsAssets = (publishedData || []).map((item: any) => {
        // Determine final_url based on image_id type
        let finalUrl = item.poster_url || item.original_url;

        if (!finalUrl && item.image_id) {
          if (item.image_id.startsWith('catalog/')) {
            // Catalog image from public folder
            finalUrl = `${publicBaseUrl}/${item.image_id}`;
          } else {
            // User-generated image from R2
            finalUrl = `${publicBaseUrl}/${item.image_id}`;
          }
        }

        return {
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          description: item.description,
          status: 'public',
          tags: item.tags || [],
          price: item.price,
          likes: item.likes || 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          // image_id is now TEXT, can be either UUID or catalog path like "catalog/01.png"
          final_key: item.image_id,
          final_url: finalUrl,
          raw_key: null,
          raw_url: null,
          metadata: {
            width: 1024,
            height: 1536,
            mime_type: 'image/png'
          }
        };
      });

      // Combine, deduplicate by image URL, and sort by created_at
      const combined = [...(assetsData || []), ...publishedAsAssets];
      const seenUrls = new Set<string>();
      data = combined.filter((item) => {
        const url = item.final_url || item.final_key;
        if (!url || seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      error = assetsError || publishedError;
    } else if (scope === 'mine' && user) {
      // For 'mine' scope, fetch from assets, published_items, and images (drafts)
      let assetsQuery = supabase
        .from('assets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (cursor) {
        assetsQuery = assetsQuery.lt('created_at', cursor);
      }

      const { data: assetsData, error: assetsError } = await assetsQuery;

      // Fetch user's published items (no join needed)
      let publishedQuery = supabase
        .from('published_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (cursor) {
        publishedQuery = publishedQuery.lt('created_at', cursor);
      }

      const { data: publishedData, error: publishedError } = await publishedQuery;

      // Fetch user's draft images (not yet published)
      let imagesQuery = supabase
        .from('images')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_public', false)
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (cursor) {
        imagesQuery = imagesQuery.lt('created_at', cursor);
      }

      const { data: imagesData, error: imagesError } = await imagesQuery;

      console.log('[api/assets] User published items count:', publishedData?.length || 0);
      console.log('[api/assets] User draft images count:', imagesData?.length || 0);

      // Convert published_items to asset format
      const publishedAsAssets = (publishedData || []).map((item: any) => {
        // Determine final_url based on image_id type
        let finalUrl = item.poster_url || item.original_url;

        if (!finalUrl && item.image_id) {
          if (item.image_id.startsWith('catalog/')) {
            // Catalog image from public folder
            finalUrl = `${publicBaseUrl}/${item.image_id}`;
          } else {
            // User-generated image from R2
            finalUrl = `${publicBaseUrl}/${item.image_id}`;
          }
        }

        return {
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          description: item.description,
          status: 'public',
          tags: item.tags || [],
          price: item.price,
          likes: item.likes || 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          final_key: item.image_id,
          final_url: finalUrl,
          raw_key: null,
          raw_url: null,
          metadata: {
            width: 1024,
            height: 1536,
            mime_type: 'image/png'
          }
        };
      });

      // Convert images to asset format (drafts)
      const draftAsAssets = (imagesData || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        title: item.title || 'Untitled Design',
        description: item.description || '',
        status: 'private',
        tags: item.tags || [],
        price: item.price || 0,
        likes: 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        final_key: item.r2_key,
        final_url: item.r2_url,
        raw_key: null,
        raw_url: null,
        metadata: {
          width: item.width || 1024,
          height: item.height || 1024,
          mime_type: item.mime_type || 'image/png'
        }
      }));

      // Combine all sources, deduplicate, and sort by created_at
      const combined = [...(assetsData || []), ...publishedAsAssets, ...draftAsAssets];
      const seenUrls = new Set<string>();
      data = combined.filter((item) => {
        const url = item.final_url || item.final_key;
        if (!url || seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      error = assetsError || publishedError || imagesError;
    } else {
      // For other scopes (liked), use existing logic
      let query = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (scope === 'liked' && user) {
        // handled after fetching likes
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const result = await query;
      data = result.data || [];
      error = result.error;
    }

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

        // Fetch from assets table
        const { data: likedAssets, error: likedAssetsError } = await supabase
          .from('assets')
          .select('*')
          .in('id', likedArray)
          .order('created_at', { ascending: false })
          .limit(limitValue);

        // Fetch from published_items table
        const { data: likedPublished, error: likedPublishedError } = await supabase
          .from('published_items')
          .select(`
            *,
            images (
              id,
              r2_url,
              r2_key,
              width,
              height,
              mime_type
            )
          `)
          .in('id', likedArray)
          .order('created_at', { ascending: false })
          .limit(limitValue);

        // Fetch from generation_history table
        const { data: likedGeneration, error: likedGenerationError } = await supabase
          .from('generation_history')
          .select('*')
          .in('id', likedArray)
          .order('created_at', { ascending: false })
          .limit(limitValue);

        if (likedAssetsError || likedPublishedError || likedGenerationError) {
          console.error('[api/assets] Failed to fetch liked assets:',
            likedAssetsError?.message || likedPublishedError?.message || likedGenerationError?.message);
          if ((likedAssetsError as any)?.code === '42P01') {
            return Response.json({ assets: [], cursor: null });
          }
          return Response.json({ error: 'Failed to fetch liked assets' }, { status: 500 });
        }

        // Convert published_items to asset format
        const publishedAsAssets = (likedPublished || []).map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          description: item.description,
          status: 'public',
          tags: item.tags || [],
          price: item.price,
          likes: item.likes || 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          final_key: item.images?.r2_key || item.original_url,
          final_url: item.original_url,
          raw_key: null,
          raw_url: null,
          metadata: {
            width: item.images?.width || 1024,
            height: item.images?.height || 1024,
            mime_type: item.images?.mime_type || 'image/png'
          }
        }));

        // Convert generation_history to asset format
        const generationAsAssets = (likedGeneration || []).map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          title: 'Generated Design',
          description: '',
          status: item.status || 'private',
          tags: [],
          price: 0,
          likes: 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          final_key: item.final_r2_key,
          final_url: item.final_r2_url,
          raw_key: item.raw_r2_key,
          raw_url: item.raw_r2_url,
          metadata: item.metadata || {}
        }));

        // Combine all sources
        const allLiked = [...(likedAssets || []), ...publishedAsAssets, ...generationAsAssets];
        const filteredLiked = allLiked.filter(assetIsAllowed);

        if (filteredLiked.length === 0) {
          return Response.json({ assets: [], cursor: null });
        }

        // Sort by created_at
        filteredLiked.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

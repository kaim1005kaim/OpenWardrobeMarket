export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import { R2_PUBLIC_BASE_URL } from '../../../src/lib/r2';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const PUBLIC_URL = R2_PUBLIC_BASE_URL || 'https://pub-4215f21494de4f369c2bde9f2769dfd4.r2.dev';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function extractTagsFromFilename(filename: string): string[] {
  const tags: string[] = [];

  const yearMatch = filename.match(/(\d{4}s)/);
  if (yearMatch) tags.push(yearMatch[1]);

  const brandPatterns = [
    /Balenciaga/i, /Chanel/i, /Dior/i, /Prada/i, /Gucci/i,
    /Calvin Klein/i, /Giorgio Armani/i, /Yves Saint Laurent/i,
    /Valentino/i, /Versace/i, /Issey Miyake/i, /Comme des Garcons/i
  ];

  for (const pattern of brandPatterns) {
    if (pattern.test(filename)) {
      const match = filename.match(pattern);
      if (match) tags.push(match[0]);
      break;
    }
  }

  const styleKeywords = [
    'full-body', 'portrait', 'minimalist', 'avant-garde',
    'casual', 'elegant', 'street', 'formal', 'vintage',
    'modern', 'classic', 'luxury', 'bohemian'
  ];

  for (const keyword of styleKeywords) {
    if (filename.toLowerCase().includes(keyword.toLowerCase())) {
      tags.push(keyword);
    }
  }

  return [...new Set(tags)];
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Interleave two arrays with priority ratio
 * @param primary - Primary array (published items)
 * @param secondary - Secondary array (catalog items)
 * @param primaryRatio - Ratio of primary items (0.7 = 70% published, 30% catalog)
 */
function interleaveArrays<T>(primary: T[], secondary: T[], primaryRatio: number): T[] {
  const result: T[] = [];
  let primaryIndex = 0;
  let secondaryIndex = 0;

  while (primaryIndex < primary.length || secondaryIndex < secondary.length) {
    // Add items from primary array based on ratio
    const primaryCount = Math.random() < primaryRatio ? 2 : 1;
    for (let i = 0; i < primaryCount && primaryIndex < primary.length; i++) {
      result.push(primary[primaryIndex++]);
    }

    // Add one item from secondary array
    if (secondaryIndex < secondary.length) {
      result.push(secondary[secondaryIndex++]);
    }
  }

  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    console.log('[showcase-feed] Fetching merged feed, limit:', limit, 'offset:', offset);

    // Fetch catalog items (from assets table)
    const catalogPromise = supabase
      .from('assets')
      .select('id,title,tags,final_key,raw_key,created_at,status')
      .eq('status', 'public')
      .or('final_key.ilike.catalog/%,raw_key.ilike.catalog/%')
      .order('created_at', { ascending: false })
      .limit(1000);

    // Fetch published items
    const publishedPromise = supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Fetch more to ensure we have enough after filtering

    // Execute both queries in parallel
    const [catalogResponse, publishedResponse] = await Promise.all([
      catalogPromise,
      publishedPromise
    ]);

    if (catalogResponse.error) {
      console.error('[showcase-feed] Catalog error:', catalogResponse.error);
    }
    if (publishedResponse.error) {
      console.error('[showcase-feed] Published error:', publishedResponse.error);
    }

    // Process catalog items
    const catalogRecords = (catalogResponse.data || []).filter((row) => {
      const key = row.final_key || row.raw_key;
      return typeof key === 'string' && key.startsWith('catalog/');
    });

    const catalogItems = catalogRecords.map((row) => {
      const key = (row.final_key || row.raw_key) as string;
      const filename = key.replace(/^catalog\//, '');

      const cleanTitle = filename
        .replace(/\.(png|jpg|jpeg|webp)$/i, '')
        .replace(/_/g, ' ')
        .replace(/\([0-9]+\)/g, '')
        .trim();

      const tags = Array.isArray(row.tags) && row.tags.length > 0
        ? row.tags
        : extractTagsFromFilename(cleanTitle);

      return {
        id: row.id || key.replace(/[^a-zA-Z0-9]/g, '_'),
        src: `${PUBLIC_URL}/${key}`,
        title: cleanTitle.length > 60 ? `${cleanTitle.substring(0, 60)}...` : cleanTitle || 'Catalog Design',
        tags,
        colors: [],
        likes: 0,
        isUserGenerated: false,
        createdAt: row.created_at || new Date().toISOString(),
        metadata: {},
      };
    });

    console.log('[showcase-feed] Catalog items:', catalogItems.length);

    // Process published items
    const publishedItems = (publishedResponse.data || [])
      .map((item: any) => {
        // Try multiple fields to get image URL
        // Priority: original_url > poster_url > quadtych_urls.main > image_url
        let imageUrl = item.original_url || item.poster_url || item.image_url;

        // Check if quadtych_urls exists (both in metadata and at top level)
        const quadtychUrls = item.metadata?.quadtych_urls || item.quadtych_urls;
        if (!imageUrl && quadtychUrls?.main) {
          imageUrl = quadtychUrls.main;
        }

        // Also check if variants exist and use first variant's image
        if (!imageUrl && item.metadata?.variants && item.metadata.variants.length > 0) {
          const firstVariant = item.metadata.variants[0];
          imageUrl = firstVariant.url || firstVariant.image_url;
        }

        if (!imageUrl) {
          console.warn('[showcase-feed] Item missing image URL:', {
            id: item.id,
            title: item.title,
            availableFields: Object.keys(item),
          });
          return null;
        }

        // Filter out R2 direct URLs (unauthorized access)
        // These URLs start with https://pub-*.r2.dev
        if (imageUrl.includes('.r2.dev/')) {
          console.log('[showcase-feed] Filtering out R2 direct URL:', item.title, imageUrl);
          return null;
        }

        return {
          id: item.id,
          src: imageUrl,
          title: item.title || 'Untitled Design',
          tags: item.tags || [],
          colors: item.colors || [],
          price: item.price,
          likes: item.likes || 0,
          isUserGenerated: true,
          createdAt: item.created_at,
          userName: item.user_name,
          userAvatar: item.user_avatar,
          metadata: item.metadata || item.fusion_spec || {},
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    console.log('[showcase-feed] Published items:', publishedItems.length);

    // Sort published items by created_at (newest first)
    const sortedPublished = [...publishedItems].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    // Shuffle catalog items
    const shuffledCatalog = shuffleArray([...catalogItems]);

    // Interleave arrays (70% published, 30% catalog ratio)
    const allItems = interleaveArrays(sortedPublished, shuffledCatalog, 0.7);

    console.log('[showcase-feed] Total merged items:', allItems.length);
    console.log('[showcase-feed] First 5 items:', allItems.slice(0, 5).map(i => ({
      title: i.title,
      createdAt: i.createdAt,
      isUserGenerated: i.isUserGenerated
    })));

    // Apply offset and limit
    const paginatedItems = allItems.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        success: true,
        items: paginatedItems,
        total: allItems.length,
        catalog_count: catalogItems.length,
        published_count: publishedItems.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error: any) {
    console.error('[showcase-feed] Error fetching feed:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch showcase feed',
        details: error?.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

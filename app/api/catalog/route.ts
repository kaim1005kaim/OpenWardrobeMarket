export const runtime = 'nodejs';
export const revalidate = 0;

import { getServiceSupabase } from '../_shared/assets';

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

export async function GET(request: Request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = getServiceSupabase();

    // Fetch from published_items where category='catalog'
    const { data, error } = await supabase
      .from('published_items')
      .select('id,title,tags,poster_url,original_url,created_at')
      .eq('category', 'catalog')
      .eq('is_active', true)
      .not('poster_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[api/catalog] Supabase error:', error.message);
      throw error;
    }

    const images = (data || []).map((row) => {
      const imageUrl = row.poster_url || row.original_url || '';

      // Extract clean title
      const cleanTitle = row.title || 'Catalog Design';

      const tags = Array.isArray(row.tags) && row.tags.length > 0
        ? row.tags
        : extractTagsFromFilename(cleanTitle);

      return {
        id: row.id,
        src: imageUrl,
        title: cleanTitle.length > 60 ? `${cleanTitle.substring(0, 60)}...` : cleanTitle,
        tags,
        type: 'catalog' as const,
        liked: false,
        createdAt: row.created_at || new Date().toISOString()
      };
    });

    console.log('[api/catalog] Fetched', images.length, 'catalog items from published_items');

    return Response.json({
      images,
      total: images.length,
      source: 'published_items'
    });
  } catch (error: any) {
    console.error('Catalog API error:', error);
    return Response.json(
      {
        error: error?.message || 'Failed to fetch catalog',
        images: [],
        total: 0
      },
      { status: 500 }
    );
  }
}

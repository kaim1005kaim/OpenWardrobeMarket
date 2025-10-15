export const runtime = 'nodejs';
export const revalidate = 0;

import { getServiceSupabase } from '../_shared/assets';
import { R2_PUBLIC_BASE_URL } from '../../../src/lib/r2';

const PUBLIC_URL =
  R2_PUBLIC_BASE_URL || 'https://pub-4215f21494de4f369c2bde9f2769dfd4.r2.dev';

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

    const { data, error } = await supabase
      .from('assets')
      .select('id,title,tags,final_key,raw_key,created_at,status')
      .eq('status', 'public')
      .or('final_key.ilike.catalog/%,raw_key.ilike.catalog/%')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[api/catalog] Supabase error:', error.message);
      throw error;
    }

    const records = (data || []).filter((row) => {
      const key = row.final_key || row.raw_key;
      return typeof key === 'string' && key.startsWith('catalog/');
    });

    const images = records.map((row) => {
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
        type: 'catalog' as const,
        liked: false,
        createdAt: row.created_at || new Date().toISOString()
      };
    });

    return Response.json({
      images,
      total: images.length,
      source: 'supabase-assets'
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

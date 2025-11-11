export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Synonym dictionary: canonical form -> variants
const SYNONYMS: Record<string, string[]> = {
  pinstripe: ['stripe_pin', 'chalk_stripe', 'pinstriped'],
  leather: ['cowhide', 'calf', 'leather_material'],
  silk: ['silk_fabric', 'silky'],
  denim: ['jean', 'jeans', 'denim_fabric'],
  oversized: ['baggy', 'loose', 'relaxed'],
  minimal: ['minimalist', 'simple', 'clean'],
  tailored: ['fitted', 'structured', 'sharp'],
  embroidered: ['embroidery', 'stitched'],
  graphic: ['print', 'printed', 'pattern'],
  metallic: ['metal', 'shiny', 'chrome'],
  vintage: ['retro', 'classic'],
  luxury: ['luxe', 'premium', 'high_end'],
  casual: ['relaxed', 'informal'],
  elegant: ['sophisticated', 'refined'],
  bold: ['striking', 'statement']
};

// NG words (brands, trademarks, explicit content)
const NG_WORDS = new Set([
  'nike',
  'adidas',
  'gucci',
  'prada',
  'louis_vuitton',
  'chanel',
  'dior',
  'balenciaga',
  'supreme',
  'off_white',
  'nude',
  'naked',
  'explicit'
]);

/**
 * Normalize tag: lowercase, trim, singularize basic plurals
 */
function normalizeTag(tag: string): string {
  let normalized = tag.toLowerCase().trim().replace(/[_\s]+/g, '_');

  // Basic singularization (remove trailing 's')
  if (normalized.endsWith('s') && normalized.length > 3) {
    const singular = normalized.slice(0, -1);
    // Don't singularize words like "canvas", "glass"
    if (!['canvas', 'glass', 'brass', 'dress'].includes(normalized)) {
      normalized = singular;
    }
  }

  return normalized;
}

/**
 * Get canonical form of a tag using synonym dictionary
 */
function getCanonical(tag: string): string {
  const normalized = normalizeTag(tag);

  // Check if tag is a variant in SYNONYMS
  for (const [canonical, variants] of Object.entries(SYNONYMS)) {
    if (variants.includes(normalized) || canonical === normalized) {
      return canonical;
    }
  }

  return normalized;
}

/**
 * Filter and deduplicate tags
 */
function processTags(tags: string[]): string[] {
  const canonicalMap = new Map<string, number>();

  // Count canonical forms
  tags.forEach((tag) => {
    const canonical = getCanonical(tag);

    // Skip NG words
    if (NG_WORDS.has(canonical)) {
      return;
    }

    // Skip very short tags
    if (canonical.length < 2) {
      return;
    }

    canonicalMap.set(canonical, (canonicalMap.get(canonical) || 0) + 1);
  });

  // Sort by frequency and return top 10
  const sorted = Array.from(canonicalMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  return sorted;
}

export async function POST(req: NextRequest) {
  try {
    const { gen_id, image_id } = await req.json();

    if (!gen_id && !image_id) {
      return NextResponse.json(
        { error: 'Either gen_id or image_id is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let rawTags: string[] = [];

    // Try to get tags from generation_history first
    if (gen_id) {
      const { data: genData } = await supabase
        .from('generation_history')
        .select('tags')
        .eq('id', gen_id)
        .single();

      if (genData) {
        rawTags = genData.tags || [];
      }
    }

    // If no tags from generation, try published_items
    if (rawTags.length === 0 && image_id) {
      const { data: pubData } = await supabase
        .from('published_items')
        .select('auto_tags, tags')
        .eq('id', image_id)
        .single();

      if (pubData) {
        rawTags = pubData.auto_tags || pubData.tags || [];
      }
    }

    // Process and deduplicate tags
    const autoTags = processTags(rawTags);

    console.log('[auto/tags]', {
      gen_id,
      image_id,
      rawTags: rawTags.length,
      autoTags: autoTags.length
    });

    return NextResponse.json({ auto_tags: autoTags });
  } catch (error) {
    console.error('[auto/tags] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

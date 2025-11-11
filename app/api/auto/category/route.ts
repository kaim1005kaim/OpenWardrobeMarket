export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Category = 'luxury' | 'street' | 'outdoor' | 'workwear' | 'y2k' | 'minimal' | 'tailored';

// Category inference rules: tag patterns → weight
const CAT_RULES: Record<Category, Record<string, number>> = {
  luxury: {
    silk: 2.0,
    leather: 1.5,
    gold: 1.8,
    silver: 1.5,
    tailored: 1.2,
    elegant: 1.5,
    formal: 1.3,
    satin: 1.8,
    velvet: 1.6,
    cashmere: 2.0,
    embroidered: 1.4,
    luxury: 2.5
  },
  street: {
    graphic: 1.8,
    denim: 1.5,
    sneaker: 1.5,
    oversized: 1.3,
    hoodie: 1.6,
    distressed: 1.4,
    urban: 1.5,
    streetwear: 2.0,
    bold: 1.3,
    casual: 1.2
  },
  outdoor: {
    canvas: 1.5,
    techwear: 1.8,
    khaki: 1.4,
    utility: 1.6,
    waterproof: 1.7,
    technical: 1.5,
    nylon: 1.4,
    functional: 1.5,
    outdoor: 2.0
  },
  workwear: {
    canvas: 1.4,
    durable: 1.5,
    utility: 1.6,
    pocket: 1.3,
    workwear: 2.0,
    rugged: 1.5,
    functional: 1.4,
    sturdy: 1.5
  },
  y2k: {
    neon: 1.8,
    chrome: 1.7,
    metallic: 1.5,
    glitter: 1.6,
    lowrise: 1.4,
    futuristic: 1.5,
    shiny: 1.4,
    y2k: 2.5,
    retro: 1.3
  },
  minimal: {
    clean: 1.8,
    monochrome: 1.7,
    simple: 1.6,
    minimal: 2.0,
    minimalist: 2.0,
    neutral: 1.5,
    understated: 1.6,
    sleek: 1.4
  },
  tailored: {
    blazer: 1.8,
    tailored: 2.0,
    structured: 1.6,
    pinstripe: 1.5,
    formal: 1.4,
    suit: 1.7,
    sharp: 1.3,
    professional: 1.5
  }
};

function inferCategory(input: {
  tags: string[];
  vibe?: Record<string, number>;
}): { category: Category; confidence: number } {
  const tagCounts = new Map<string, number>();

  // Normalize and count tags
  input.tags.forEach((tag) => {
    const normalized = tag.toLowerCase().trim();
    tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
  });

  // Calculate score for each category
  const categoryScores = (Object.keys(CAT_RULES) as Category[]).map((cat) => {
    let score = 0;

    // Tag-based scoring
    Object.entries(CAT_RULES[cat]).forEach(([keyword, weight]) => {
      if (tagCounts.has(keyword)) {
        score += tagCounts.get(keyword)! * weight;
      }
    });

    // Vibe-based bonus (if provided)
    if (input.vibe && input.vibe[cat]) {
      score += input.vibe[cat] * 1.5;
    }

    return { category: cat, score };
  });

  // Sort by score
  categoryScores.sort((a, b) => b.score - a.score);

  const [best, second] = categoryScores;

  // Calculate confidence (0-1)
  const confidence =
    best.score === 0 ? 0 : Math.min(1, (best.score - second.score) / Math.max(best.score, 1));

  return {
    category: best.category,
    confidence: Math.round(confidence * 100) / 100
  };
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

    let tags: string[] = [];
    let vibe: Record<string, number> | undefined;

    // Try to get tags from generation_history first
    if (gen_id) {
      const { data: genData } = await supabase
        .from('generation_history')
        .select('tags, metadata')
        .eq('id', gen_id)
        .single();

      if (genData) {
        tags = genData.tags || [];
        vibe = genData.metadata?.vibe_vector;
      }
    }

    // If no tags from generation, try published_items
    if (tags.length === 0 && image_id) {
      const { data: pubData } = await supabase
        .from('published_items')
        .select('auto_tags, tags')
        .eq('id', image_id)
        .single();

      if (pubData) {
        tags = pubData.auto_tags || pubData.tags || [];
      }
    }

    // Infer category
    const result = inferCategory({ tags, vibe });

    console.log('[auto/category]', {
      gen_id,
      image_id,
      tags,
      result
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[auto/category] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

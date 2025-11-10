export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('[ai-pricing] Missing GOOGLE_API_KEY');
}

const PRICING_PROMPT = `You are a fashion design valuation expert. Analyze this design and provide a quality score.

Base context:
- This is a fashion design to be purchased as source material for professional designers
- Base human labor cost for original design: ¥30,000
- Adjusted base price for design elements/inspiration: ¥15,000
- Your score will adjust this base price up or down

Evaluation criteria:
1. **Design complexity & craftsmanship** (0-10)
   - Intricate details, layering, construction difficulty
   - Professional finish and attention to detail

2. **Originality & creativity** (0-10)
   - Unique silhouette, innovative use of materials
   - Fresh interpretation vs. derivative work

3. **Commercial viability** (0-10)
   - Market appeal, versatility, trend relevance
   - Production feasibility

4. **Artistic merit** (0-10)
   - Visual impact, color harmony, composition
   - Conceptual coherence

Respond with JSON:
{
  "quality_score": <number 0-100>,
  "complexity": <number 0-10>,
  "originality": <number 0-10>,
  "commercial_viability": <number 0-10>,
  "artistic_merit": <number 0-10>,
  "reasoning": "<brief explanation in Japanese>"
}`;

interface PricingInput {
  imageData: string;
  mimeType: string;
  autoTags?: string[];
  likes?: number;
  category?: string;
}

interface QualityScore {
  quality_score: number;
  complexity: number;
  originality: number;
  commercial_viability: number;
  artistic_merit: number;
  reasoning: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body: PricingInput = await req.json();
    const { imageData, mimeType, autoTags, likes, category } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: 'Missing imageData' },
        { status: 400 }
      );
    }

    console.log('[ai-pricing] Analyzing design quality...');

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Get Gemini Vision quality assessment
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: PRICING_PROMPT },
            {
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    });

    const qualityData: QualityScore = JSON.parse(result.response.text());
    console.log('[ai-pricing] Quality score:', qualityData.quality_score);

    // 2. Calculate genre popularity (purchase rate & likes)
    let genreMultiplier = 1.0;

    if (autoTags && autoTags.length > 0) {
      // Get purchase stats for similar designs (by tags)
      const { data: genreStats } = await supabase
        .from('published_items')
        .select('category, auto_tags, likes')
        .overlaps('auto_tags', autoTags)
        .limit(100);

      if (genreStats && genreStats.length > 0) {
        const avgLikes = genreStats.reduce((sum, item) => sum + (item.likes || 0), 0) / genreStats.length;

        // Genre is popular if avg likes > 5
        if (avgLikes > 5) {
          genreMultiplier = 1.0 + (Math.min(avgLikes, 20) / 100); // Max +20%
          console.log('[ai-pricing] Genre multiplier:', genreMultiplier, `(avg likes: ${avgLikes})`);
        }
      }
    }

    // 3. Likes popularity boost
    const likesBoost = likes ? Math.min(likes * 0.02, 0.3) : 0; // 2% per like, max +30%
    console.log('[ai-pricing] Likes boost:', likesBoost, `(${likes || 0} likes)`);

    // 4. Scarcity check (fewer similar designs = higher price)
    let scarcityMultiplier = 1.0;

    if (autoTags && autoTags.length > 0) {
      const { count } = await supabase
        .from('published_items')
        .select('id', { count: 'exact', head: true })
        .overlaps('auto_tags', autoTags);

      if (count !== null) {
        // Rare if fewer than 50 similar designs
        if (count < 50) {
          scarcityMultiplier = 1.0 + ((50 - count) / 500); // Max +10% for unique designs
          console.log('[ai-pricing] Scarcity multiplier:', scarcityMultiplier, `(${count} similar)`);
        }
      }
    }

    // 5. Calculate final price
    const BASE_PRICE = 15000;

    // Quality score affects base price: 0-100 → 0.5x to 1.5x
    const qualityMultiplier = 0.5 + (qualityData.quality_score / 100);

    let finalPrice = BASE_PRICE * qualityMultiplier * genreMultiplier * scarcityMultiplier;
    finalPrice = finalPrice * (1 + likesBoost);

    // Round to nearest 100 yen
    finalPrice = Math.round(finalPrice / 100) * 100;

    // Ensure minimum 5,000 yen, maximum 50,000 yen
    finalPrice = Math.max(5000, Math.min(50000, finalPrice));

    console.log('[ai-pricing] Final price:', finalPrice);

    const breakdown = {
      base_price: BASE_PRICE,
      quality_score: qualityData.quality_score,
      quality_multiplier: qualityMultiplier,
      genre_multiplier: genreMultiplier,
      scarcity_multiplier: scarcityMultiplier,
      likes_boost: likesBoost,
      final_price: finalPrice,
      reasoning: qualityData.reasoning,
      quality_details: {
        complexity: qualityData.complexity,
        originality: qualityData.originality,
        commercial_viability: qualityData.commercial_viability,
        artistic_merit: qualityData.artistic_merit,
      },
    };

    return NextResponse.json(breakdown);
  } catch (error) {
    console.error('[ai-pricing] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

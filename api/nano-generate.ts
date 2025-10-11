import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';

// R2 Client
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

const NEGATIVE_PROMPT = "text, words, letters, typography, signs, labels, multiple people, collage, grid, panels, frames, split screen, comic style, manga panels, multiple angles, contact sheet";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, negative, aspectRatio = '3:4', answers } = req.body;

    // 1) Supabase Auth
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('[Nano Generate] Auth error:', userErr);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Nano Generate] User authenticated:', user.id);

    // 2) ImagineAPI呼び出し
    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography`;
    const finalNegative = negative ? `${NEGATIVE_PROMPT}, ${negative}` : NEGATIVE_PROMPT;

    console.log('[Nano Generate] Generating with prompt:', fullPrompt);

    const payload = {
      model: process.env.IMAGINE_API_MODEL || 'mj',
      prompt: fullPrompt,
      negative_prompt: finalNegative,
      quality: 'standard',
      params: {
        q: 1,
        s: 150,
        v: 7,
        aspectRatio: aspectRatio
      },
      count: 1
    };

    const response = await fetch(`${process.env.IMAGINE_API_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.IMAGINE_API_TOKEN}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      throw new Error(`ImagineAPI error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const result: any = await response.json();

    // Extract image URL
    let imageUrl: string | undefined;
    if (result.results && Array.isArray(result.results) && result.results[0]) {
      imageUrl = result.results[0].image_url || result.results[0].url;
    } else if (result.images && Array.isArray(result.images) && result.images[0]) {
      imageUrl = result.images[0].url;
    } else if (result.url) {
      imageUrl = result.url;
    }

    if (!imageUrl) {
      throw new Error('No image URL returned from ImagineAPI');
    }

    console.log('[Nano Generate] Image URL received:', imageUrl);

    // 3) Download image and upload to R2
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to download image: ${imgResponse.status}`);
    }

    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const ext = imageUrl.includes('.webp') ? 'webp' : imageUrl.includes('.jpg') ? 'jpg' : 'png';

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth() + 1}`.padStart(2, '0');
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: imgBuffer,
        ContentType: `image/${ext}`,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;
    console.log('[Nano Generate] Saved to R2:', key);

    // 4) Supabase履歴Insert
    const { data: row, error: insErr } = await supabase
      .from('generation_history')
      .insert({
        user_id: user.id,
        provider: 'imagine',
        model: process.env.IMAGINE_API_MODEL || 'mj',
        prompt,
        negative_prompt: finalNegative,
        aspect_ratio: aspectRatio,
        image_bucket: R2_BUCKET,
        image_path: key,
        image_url: publicUrl,
        folder: 'usergen',
        mode: 'mobile-simple',
        generation_data: answers ?? null,
        completion_status: 'completed',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Nano Generate] DB insert error:', insErr);
      throw insErr;
    }

    console.log('[Nano Generate] Saved to DB:', row.id);

    return res.status(200).json({ id: row.id, url: publicUrl, path: key });
  } catch (e: any) {
    console.error('[Nano Generate] Error:', e);
    return res.status(500).json({ error: e?.message || 'Generation failed' });
  }
}

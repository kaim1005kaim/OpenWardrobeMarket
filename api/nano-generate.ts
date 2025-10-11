import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

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

function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

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

    // 2) Gemini 2.5 Flash Image生成（Nano Banana）
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });
    const fullPrompt = `${prompt}${negative ? `. Negative: ${negative}` : ''}`;

    console.log('[Nano Generate] Generating with prompt:', fullPrompt);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 1,
      },
    });

    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      return res.status(500).json({ error: 'No image generated' });
    }

    const parts = candidates[0].content.parts;
    const inlineData = parts.find((p: any) => p.inlineData)?.inlineData;

    if (!inlineData?.data) {
      return res.status(500).json({ error: 'No image data' });
    }

    const buf = b64ToBuffer(inlineData.data);
    const mime = inlineData.mimeType || 'image/png';
    const ext = mime.includes('webp') ? 'webp' : 'png';

    console.log('[Nano Generate] Image generated, size:', buf.length, 'bytes');

    // 3) R2保存
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth() + 1}`.padStart(2, '0');
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buf,
        ContentType: mime,
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
        provider: 'gemini',
        model: 'gemini-2.5-flash-image',
        prompt,
        negative_prompt: negative,
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

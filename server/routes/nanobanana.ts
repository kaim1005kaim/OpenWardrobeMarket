import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Initialize R2 (S3-compatible) client
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

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for server-side
);

function b64ToBuffer(b64: string) {
  return Buffer.from(b64, 'base64');
}

// POST /api/nano-generate
router.post('/nano-generate', async (req, res) => {
  try {
    const { prompt, negative, aspectRatio = '3:4', answers } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const token = authHeader.substring(7);

    // Verify user with Supabase
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('Auth error:', userErr);
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Generate image with Gemini 2.5 Flash Image
    const fullPrompt = `${prompt}${negative ? `. ${negative}` : ''}`;
    console.log('[Nano Banana] Generating image for user:', user.id);
    console.log('[Nano Banana] Prompt:', fullPrompt);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
    const genRes = await model.generateContent(fullPrompt);

    const parts: any[] = genRes.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('[Nano Banana] No image data in response');
      return res.status(500).json({ error: 'no-image' });
    }

    const buf = b64ToBuffer(inline.data);
    const mime = inline.mimeType || 'image/png';
    const ext = mime.includes('webp') ? 'webp' : 'png';

    // Upload to R2
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth()+1}`.padStart(2,'0');
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    console.log('[Nano Banana] Uploading to R2:', key);

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

    // Save to generation_history
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
        completion_status: 'completed'
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Nano Banana] Insert error:', insErr);
      throw insErr;
    }

    console.log('[Nano Banana] Generation complete:', row.id);
    return res.json({ id: row.id, url: publicUrl, path: key });

  } catch (e: any) {
    console.error('[Nano Banana] Error:', e);
    return res.status(500).json({
      error: e?.message || 'failed'
    });
  }
});

export const nanoBananaRoutes = router;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAI } from '@google-cloud/vertexai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Vercel Functionのタイムアウトを60秒に設定
export const config = {
  maxDuration: 60,
};

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

    // 認証
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('[Vertex AI] Auth error:', userErr);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Vertex AI] Generating image for user:', user.id);

    // Vertex AI認証情報の設定
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'owm-production',
      location: 'us-central1',
      googleAuthOptions: {
        credentials,
      },
    });

    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${negative ? `. Negative: ${negative}` : ''}`;

    console.log('[Vertex AI] Prompt:', fullPrompt);

    // Imagen 3で画像生成
    const generativeModel = vertexAI.preview.getGenerativeModel({
      model: 'imagen-3.0-generate-001',
    });

    const result = await generativeModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.4,
        topP: 1.0,
        topK: 32,
        maxOutputTokens: 2048,
      }
    });

    console.log('[Vertex AI] Generation response received');

    // Vertex AIのレスポンスから画像データを抽出
    const parts: any[] = result.response?.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p: any) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('[Vertex AI] No image data in response');
      return res.status(500).json({ error: 'No image generated' });
    }

    const mime = inline.mimeType || 'image/png';
    const ext = mime.includes('webp') ? 'webp' : 'png';
    const buffer = Buffer.from(inline.data, 'base64');

    // R2にアップロード
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

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}.${ext}`;

    console.log('[Vertex AI] Uploading to R2:', key);

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

    // generation_historyに保存
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: row, error: insErr } = await supabaseAdmin
      .from('generation_history')
      .insert({
        user_id: user.id,
        provider: 'vertex-ai',
        model: 'imagen-3.0-generate-001',
        prompt,
        negative_prompt: negative,
        aspect_ratio: aspectRatio,
        image_bucket: R2_BUCKET,
        image_path: key,
        r2_url: publicUrl,
        folder: 'usergen',
        mode: 'mobile-simple',
        generation_data: answers ?? null,
        completion_status: 'completed',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Vertex AI] DB insert error:', insErr);
      throw insErr;
    }

    console.log('[Vertex AI] Generation complete:', row.id);

    // 同期処理なので即座にURLを返す
    return res.status(200).json({
      id: row.id,
      url: publicUrl,
      path: key,
      status: 'completed'
    });
  } catch (e: any) {
    console.error('[Vertex AI] Error:', e);
    return res.status(500).json({ error: e?.message || 'Generation failed' });
  }
}

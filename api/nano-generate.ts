import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
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
    const { prompt, negative, aspectRatio = '3:4', answers, publish = false } = req.body;

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
      console.error('[Gemini API] Auth error:', userErr);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Gemini API] Generating image for user:', user.id);

    // Gemini API (AI Studio) で画像生成
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${negative ? `. Negative: ${negative}` : ''}`;

    console.log('[Gemini API] Prompt:', fullPrompt);

    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: fullPrompt,
      generationConfig: { imageConfig: { aspectRatio } },
    } as any);

    console.log('[Gemini API] Generation response received');
    console.log('[Gemini API] Response structure:', JSON.stringify({
      hasCandidates: !!resp.candidates,
      candidatesLength: resp.candidates?.length,
      firstCandidate: resp.candidates?.[0] ? {
        hasContent: !!resp.candidates[0].content,
        hasParts: !!resp.candidates[0].content?.parts,
        partsLength: resp.candidates[0].content?.parts?.length,
        finishReason: resp.candidates[0].finishReason,
        safetyRatings: resp.candidates[0].safetyRatings,
      } : null,
    }, null, 2));

    const parts: any[] = resp.candidates?.[0]?.content?.parts ?? [];
    console.log('[Gemini API] Parts:', parts.map((p: any) => ({
      hasInlineData: !!p.inlineData,
      hasText: !!p.text,
      keys: Object.keys(p),
    })));

    const inline = parts.find((p: any) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('[Gemini API] No image data in response');
      console.error('[Gemini API] Full response:', JSON.stringify(resp, null, 2));
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

    console.log('[Gemini API] Uploading to R2:', key);

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
        provider: 'gemini-api',
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
      console.error('[Gemini API] DB insert error:', insErr);
      throw insErr;
    }

    console.log('[Gemini API] Generation complete:', row.id);

    const tagSet = new Set<string>();
    if (Array.isArray(answers?.vibe)) tagSet.add(answers.vibe[0]);
    if (Array.isArray(answers?.silhouette)) tagSet.add(answers.silhouette[0]);
    if (Array.isArray(answers?.color)) tagSet.add(answers.color[0]);
    if (Array.isArray(answers?.occasion)) tagSet.add(answers.occasion[0]);
    if (Array.isArray(answers?.season)) tagSet.add(answers.season[0]);

    const tags = Array.from(tagSet).filter(Boolean);

    const { data: assetRecord, error: assetError } = await supabaseAdmin
      .from('assets')
      .insert({
        user_id: user.id,
        title: row.prompt || 'Generated Design',
        description: '',
        tags: tags.length ? tags : ['generated'],
        status: publish ? 'public' : 'private',
        raw_key: key,
        raw_url: null,
        final_key: key, // final_keyにも同じキーを設定
        final_url: null,
        file_size: buffer.byteLength
      })
      .select('id')
      .single();

    if (assetError) {
      console.error('[Gemini API] Failed to create asset record:', assetError);
    }

    // 同期処理なので即座にURLを返す
    return res.status(200).json({
      id: row.id,
      assetId: assetRecord?.id ?? null,
      url: publicUrl,
      path: key,
      status: 'completed'
    });
  } catch (e: any) {
    console.error('[Gemini API] Error:', e);
    return res.status(500).json({ error: e?.message || 'Generation failed' });
  }
}

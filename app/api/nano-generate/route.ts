// app/api/nano-generate/route.ts
export const runtime = 'nodejs';
export const revalidate = 0;

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export async function POST(req: Request) {
  try {
    const { prompt, negative, aspectRatio = '3:4' } = await req.json();

    // 認証
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'No authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('[Generator API] Auth error:', userErr);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Generator API] Generating image for user:', user.id);

    // Gemini APIで画像生成
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

    const cleanNegative = (negative || '').replace(/no watermark|no signature/gi, '').replace(/,,/g, ',').trim();
    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${cleanNegative ? `. Negative: ${cleanNegative}` : ''}`;

    console.log('[Generator API] Prompt:', fullPrompt);

    // Gemini API uses aspect_ratio string in config.imageConfig
    console.log('[Generator API] Generating with aspect ratio:', aspectRatio);

    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: fullPrompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio
        }
      },
    } as any);

    const parts: any[] = resp.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p: any) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('[Generator API] No image data in response');
      console.error('[Generator API] Full response:', JSON.stringify(resp, null, 2));
      return Response.json({ error: 'No image generated' }, { status: 500 });
    }

    // R2に保存するためのユニークなキーを生成
    const mimeType = inline.mimeType || 'image/png';
    const ext = mimeType.includes('webp') ? 'webp' : 'png';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}.${ext}`;

    // 生成した画像データ(base64)と、R2用のキー、MIMEタイプを返す
    return Response.json({
      imageData: inline.data, // base64 string
      mimeType: mimeType,
      key: key, // R2に保存する際のパス
    });

  } catch (e: any) {
    console.error('[Generator API] Error:', e);
    return Response.json({ error: e?.message || 'Generation failed' }, { status: 500 });
  }
}

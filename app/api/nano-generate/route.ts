// app/api/nano-generate/route.ts
export const runtime = 'nodejs';
export const revalidate = 0;

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

    // Gemini APIで画像生成 (REST API直接呼び出し)
    const cleanNegative = (negative || '').replace(/no watermark|no signature/gi, '').replace(/,,/g, ',').trim();
    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${cleanNegative ? `. Negative: ${cleanNegative}` : ''}`;

    console.log('[Generator API] Prompt:', fullPrompt);
    console.log('[Generator API] Generating with aspect ratio:', aspectRatio);

    // Use REST API instead of SDK
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GOOGLE_API_KEY!}`;

    const fetchResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }],
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio
          }
        },
      }),
    });

    if (!fetchResp.ok) {
      const errorText = await fetchResp.text();
      console.error('[Generator API] Google AI API error:', errorText);
      return Response.json({ error: `Google AI API error: ${fetchResp.status}` }, { status: 500 });
    }

    const resp = await fetchResp.json();
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

    // R2にアップロード
    console.log('[Generator API] Uploading to R2:', key);
    const r2Bucket = process.env.R2_BUCKET_NAME!;
    const r2AccountId = process.env.R2_ACCOUNT_ID!;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

    const r2Endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(inline.data, 'base64');

    // Upload to R2
    const uploadUrl = `${r2Endpoint}/${r2Bucket}/${key}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${r2AccessKeyId}`,
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      console.error('[Generator API] R2 upload failed:', await uploadResponse.text());
      // Fallback: return base64 if upload fails
      return Response.json({
        imageData: inline.data,
        mimeType: mimeType,
        key: key,
      });
    }

    // Construct public URL
    const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || 'https://assets.open-wardrobe-market.com';
    const imageUrl = `${publicBaseUrl}/${key}`;

    console.log('[Generator API] Image uploaded successfully:', imageUrl);

    // Return image URL and data
    return Response.json({
      imageData: inline.data, // base64 string (for immediate preview)
      mimeType: mimeType,
      key: key,
      imageUrl: imageUrl, // Public URL for permanent access
    });

  } catch (e: any) {
    console.error('[Generator API] Error:', e);
    return Response.json({ error: e?.message || 'Generation failed' }, { status: 500 });
  }
}

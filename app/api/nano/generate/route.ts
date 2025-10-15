export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// R2 configuration
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, negative, aspectRatio, answers, dna, parentAssetId } = body;

    if (!prompt || !dna) {
      return NextResponse.json(
        { error: 'prompt and dna are required' },
        { status: 400 }
      );
    }

    console.log('[nano/generate] Request:', {
      user_id: user.id,
      prompt,
      aspectRatio,
      parentAssetId,
    });

    // Generate image with Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

    const cleanNegative = (negative || '')
      .replace(/no watermark|no signature/gi, '')
      .replace(/,,/g, ',')
      .trim();

    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${
      cleanNegative ? `. Negative: ${cleanNegative}` : ''
    }`;

    console.log('[nano/generate] Full prompt:', fullPrompt);

    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: fullPrompt,
      generationConfig: { imageConfig: { aspectRatio: aspectRatio || '3:4' } },
    } as any);

    const parts: any[] = resp.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p: any) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('[nano/generate] No image data in response');
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // Upload to R2
    const mimeType = inline.mimeType || 'image/png';
    const ext = mimeType.includes('webp') ? 'webp' : 'png';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const key = `generated/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}.${ext}`;

    const buffer = Buffer.from(inline.data, 'base64');

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const imageUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

    console.log('[nano/generate] Uploaded to R2:', imageUrl);

    // Save to generation_history with DNA
    const { data: historyRecord, error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        image_path: key,
        prompt: prompt,
        dna: dna,
        parent_asset_id: parentAssetId || null,
        is_public: false,
      })
      .select()
      .single();

    if (historyError) {
      console.error('[nano/generate] Failed to save to generation_history:', historyError);
    } else {
      console.log('[nano/generate] Saved to generation_history:', historyRecord.id);
    }

    // Save to assets table with DNA and lineage
    const { data: assetRecord, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        final_url: imageUrl,
        final_key: key,
        status: 'private',
        dna: dna,
        parent_asset_id: parentAssetId || null,
        lineage_tags: parentAssetId ? ['remix'] : [],
        metadata: {
          width: 1024,
          height: aspectRatio === '3:4' ? 1365 : 1024,
          mime_type: mimeType,
        },
      })
      .select()
      .single();

    if (assetError) {
      console.error('[nano/generate] Failed to save to assets:', assetError);
      return NextResponse.json(
        { error: 'Failed to save asset: ' + assetError.message },
        { status: 500 }
      );
    }

    console.log('[nano/generate] Created asset:', assetRecord.id);

    return NextResponse.json({
      id: assetRecord.id,
      url: imageUrl,
      key: key,
      historyId: historyRecord?.id,
    });
  } catch (error) {
    console.error('[nano/generate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

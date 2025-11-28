export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // v2.0 TEMPORARY: Allow anonymous access for FUSION migration
    let user: any = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authenticatedUser) {
        user = authenticatedUser;
      }
    }

    // If no authenticated user, use anonymous user ID
    if (!user) {
      user = { id: 'anonymous' };
      console.log('[save-generation] Anonymous user request');
    }

    // user_idはUUID参照なので、匿名の場合や不正UUIDはnullで保存する
    const userId =
      typeof user?.id === 'string' && /^[0-9a-fA-F-]{36}$/.test(user.id)
        ? user.id
        : null;

    const body = await req.json();
    const { imageUrl, imageKey, metadata } = body;

    if (!imageUrl || !imageKey) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, imageKey' },
        { status: 400 }
      );
    }

    console.log('[save-generation] Saving generation:', imageKey);

    // Save to generation_history
    const { data: historyRecord, error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        image_path: imageKey,
        prompt: metadata?.prompt || '',
        dna: metadata?.dna || null,
        parent_asset_id: metadata?.parentAssetId || null,
        is_public: false,
      })
      .select()
      .single();

    if (historyError) {
      console.error('[save-generation] Failed to save to generation_history:', historyError);
    }

    // Save to assets table
    const { data: assetRecord, error: assetError} = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        title: metadata?.title || 'Generated Design',
        description: metadata?.prompt || '',
        tags: Array.isArray(metadata?.tags) ? metadata?.tags : [],
        final_url: imageUrl,
        final_key: imageKey,
        raw_key: imageKey, // rawとfinalを同一にしておく（生成画像）
        raw_url: null,
        status: 'private',
        dna: metadata?.dna || null,
        parent_asset_id: metadata?.parentAssetId || null,
        lineage_tags: metadata?.parentAssetId ? ['remix'] : [],
        metadata: {
          width: 1024,
          height: metadata?.aspectRatio === '3:4' ? 1365 : 1024,
          mime_type: 'image/jpeg',
        },
        likes_count: 0,
        file_size: metadata?.fileSize ?? null,
      })
      .select()
      .single();

    if (assetError) {
      console.error('[save-generation] Failed to save to assets:', assetError);
      return NextResponse.json(
        { error: 'Failed to save asset: ' + assetError.message },
        { status: 500 }
      );
    }

    console.log('[save-generation] Created asset:', assetRecord.id);

    return NextResponse.json({
      success: true,
      generationId: assetRecord.id,
      imageUrl: imageUrl,
    });

  } catch (error: any) {
    console.error('[save-generation] Error:', error);
    return NextResponse.json(
      {
        error: 'Save failed',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

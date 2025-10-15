export const runtime = 'nodejs';
export const revalidate = 0;

import { getAuthUser, getServiceSupabase, serializeAsset } from '../../_shared/assets';
import { R2_PUBLIC_BASE_URL, R2_BUCKET } from '../../../../src/lib/r2.js';

const DEFAULT_STATUS = 'private';

export async function POST(request: Request) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      key,
      title,
      tags,
      status = DEFAULT_STATUS,
      dna,
      answers,
      prompt,
      fileSize
    } = body;

    if (!key || typeof key !== 'string') {
      return Response.json({ error: 'key is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const publicUrl =
      R2_PUBLIC_BASE_URL && typeof R2_PUBLIC_BASE_URL === 'string'
        ? `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key.replace(/^\/+/, '')}`
        : null;

    // generation_historyへの履歴保存（失敗しても処理は続行）
    try {
      await supabase.from('generation_history').insert({
        user_id: user.id,
        provider: 'gemini-2.5',
        model: 'gemini-2.5-flash-image',
        prompt: prompt ?? title ?? null,
        negative_prompt: null,
        aspect_ratio: '3:4',
        image_bucket: R2_BUCKET,
        image_path: key,
        image_url: publicUrl,
        folder: 'usergen',
        mode: 'mobile-simple',
        generation_data: {
          dna: dna ?? null,
          answers: answers ?? null
        },
        completion_status: 'completed'
      });
    } catch (historyError) {
      console.warn('[api/assets/create] generation_history insert failed:', historyError);
    }

    const { data: inserted, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        title: title ?? 'Generated Design',
        description: '',
        tags: Array.isArray(tags) ? tags : [],
        status,
        raw_key: key,
        raw_url: null,
        final_key: key,
        final_url: publicUrl,
        file_size: typeof fileSize === 'number' ? fileSize : null,
        likes_count: 0
      })
      .select('*')
      .single();

    if (assetError || !inserted) {
      console.error('[api/assets/create] Asset insert error:', assetError?.message);
      return Response.json({ error: 'Failed to create asset' }, { status: 500 });
    }

    const serialized = await serializeAsset(inserted, {
      kind: 'final',
      includeRaw: true
    });

    return Response.json({ asset: serialized }, { status: 201 });
  } catch (error: any) {
    console.error('[api/assets/create] Unexpected error:', error);
    return Response.json(
      { error: 'Internal Server Error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

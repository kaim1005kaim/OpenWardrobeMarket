export const runtime = 'nodejs';
export const revalidate = 0;

import { getAuthUser, getServiceSupabase, serializeAsset } from '../../_shared/assets';

const ALLOWED_STATUSES = new Set(['public', 'private', 'delisted']);

type AssetRouteParams = { assetId: string };
type AssetRouteContext = { params: Promise<AssetRouteParams> };

export async function PATCH(
  request: Request,
  context: AssetRouteContext
) {
  const { assetId } = await context.params;

  if (!assetId) {
    return Response.json({ error: 'assetId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    const { user } = await getAuthUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body?.status;

    if (!ALLOWED_STATUSES.has(status)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('assets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', assetId)
      .select('*')
      .single();

    if (updateError || !updated) {
      console.error('[api/assets/[id]] Update error:', updateError?.message);
      return Response.json({ error: 'Failed to update asset status' }, { status: 500 });
    }

    const serialized = await serializeAsset(updated, {
      kind: 'final',
      includeRaw: true
    });

    return Response.json({ asset: serialized });
  } catch (error: any) {
    console.error('[api/assets/[id]] PATCH error:', error);
    return Response.json(
      { error: 'Unexpected error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: AssetRouteContext
) {
  const { assetId } = await context.params;

  if (!assetId) {
    return Response.json({ error: 'assetId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    const { user } = await getAuthUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('assets')
      .select('id, user_id')
      .eq('id', assetId)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('assets')
      .update({ status: 'delisted', updated_at: new Date().toISOString() })
      .eq('id', assetId);

    if (deleteError) {
      console.error('[api/assets/[id]] Delete error:', deleteError.message);
      return Response.json({ error: 'Failed to delete asset' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('[api/assets/[id]] DELETE error:', error);
    return Response.json(
      { error: 'Unexpected error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  context: AssetRouteContext
) {
  const { assetId } = await context.params;

  if (!assetId) {
    return Response.json({ error: 'assetId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }

    const serialized = await serializeAsset(data, {
      kind: 'final',
      includeRaw: true
    });

    return Response.json({ asset: serialized });
  } catch (error: any) {
    console.error('[api/assets/[id]] GET error:', error);
    return Response.json(
      { error: 'Unexpected error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

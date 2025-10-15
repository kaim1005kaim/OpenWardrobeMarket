export const runtime = 'nodejs';
export const revalidate = 0;

import { getAuthUser, getServiceSupabase } from '../../_shared/assets';

type RouteParams = { assetId: string };
type RouteContext = { params: Promise<RouteParams> };

export async function POST(
  request: Request,
  context: RouteContext
) {
  const { assetId } = await context.params;
  if (!assetId) {
    return Response.json({ error: 'assetId is required' }, { status: 400 });
  }

  const { user } = await getAuthUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  try {
    const { error } = await supabase
      .from('likes')
      .upsert(
        {
          user_id: user.id,
          asset_id: assetId
        },
        { onConflict: 'user_id,asset_id' }
      );

    if (error) {
      console.error('[api/likes] upsert error:', error.message);
      return Response.json({ error: 'Failed to like asset' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('[api/likes] POST error:', error);
    return Response.json(
      { error: 'Unexpected error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  const { assetId } = await context.params;
  if (!assetId) {
    return Response.json({ error: 'assetId is required' }, { status: 400 });
  }

  const { user } = await getAuthUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  try {
    const { error } = await supabase
      .from('likes')
      .delete()
      .match({ user_id: user.id, asset_id: assetId });

    if (error) {
      console.error('[api/likes] delete error:', error.message);
      return Response.json({ error: 'Failed to unlike asset' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('[api/likes] DELETE error:', error);
    return Response.json(
      { error: 'Unexpected error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

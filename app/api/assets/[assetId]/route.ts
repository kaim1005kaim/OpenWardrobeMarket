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

    // Try assets table first
    let { data: existing, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    let isFromImagesTable = false;

    // If not found in assets, check images table
    if (fetchError || !existing) {
      const { data: imageData, error: imageError } = await supabase
        .from('images')
        .select('*')
        .eq('id', assetId)
        .single();

      if (imageError || !imageData) {
        return Response.json({ error: 'Asset not found' }, { status: 404 });
      }

      existing = imageData;
      isFromImagesTable = true;
    }

    if (existing.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let updated;
    let updateError;

    if (isFromImagesTable) {
      // Update is_public in images table
      const isPublic = status === 'public';
      const result = await supabase
        .from('images')
        .update({ is_public: isPublic, updated_at: new Date().toISOString() })
        .eq('id', assetId)
        .select('*')
        .single();

      updated = result.data;
      updateError = result.error;

      // If making public, create published_items entry
      if (!updateError && isPublic && updated) {
        // Check if published_items entry already exists
        const { data: existingPublished } = await supabase
          .from('published_items')
          .select('id')
          .eq('image_id', assetId)
          .single();

        if (!existingPublished) {
          // Create new published_items entry
          const { error: publishError } = await supabase
            .from('published_items')
            .insert({
              user_id: user.id,
              image_id: assetId,
              title: updated.title || 'Untitled Design',
              description: updated.description || '',
              price: updated.price || 0,
              tags: updated.tags || [],
              colors: updated.colors || [],
              category: 'clothing',
              is_active: true,
              original_url: updated.r2_url,
              poster_url: updated.r2_url,
              sale_type: 'buyout'
            });

          if (publishError) {
            console.error('[api/assets/[id]] Failed to create published_items:', publishError.message);
            // Continue anyway - the image is still marked as public
          } else {
            console.log('[api/assets/[id]] Created published_items entry for image:', assetId);
          }
        }
      }

      // If making private, deactivate published_items entry
      if (!updateError && !isPublic && updated) {
        const { error: unpublishError } = await supabase
          .from('published_items')
          .update({ is_active: false })
          .eq('image_id', assetId);

        if (unpublishError) {
          console.error('[api/assets/[id]] Failed to deactivate published_items:', unpublishError.message);
        } else {
          console.log('[api/assets/[id]] Deactivated published_items for image:', assetId);
        }
      }
    } else {
      // Update status in assets table
      const result = await supabase
        .from('assets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', assetId)
        .select('*')
        .single();

      updated = result.data;
      updateError = result.error;
    }

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

    // Try assets table first
    let { data: existing, error: fetchError } = await supabase
      .from('assets')
      .select('id, user_id')
      .eq('id', assetId)
      .single();

    let isFromImagesTable = false;

    // If not found in assets, check images table
    if (fetchError || !existing) {
      const { data: imageData, error: imageError } = await supabase
        .from('images')
        .select('id, user_id')
        .eq('id', assetId)
        .single();

      if (imageError || !imageData) {
        return Response.json({ error: 'Asset not found' }, { status: 404 });
      }

      existing = imageData;
      isFromImagesTable = true;
    }

    if (existing.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let deleteError;

    if (isFromImagesTable) {
      // For images table, we can either delete or set is_public to false
      // Let's actually delete the record
      const result = await supabase
        .from('images')
        .delete()
        .eq('id', assetId);

      deleteError = result.error;
    } else {
      // For assets table, soft delete by setting status to delisted
      const result = await supabase
        .from('assets')
        .update({ status: 'delisted', updated_at: new Date().toISOString() })
        .eq('id', assetId);

      deleteError = result.error;
    }

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

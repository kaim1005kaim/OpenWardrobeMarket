export const runtime = 'nodejs';
export const revalidate = 0;

import { getAuthUser, getServiceSupabase } from '../../_shared/assets';
import { evolveProfile } from '../../../../src/lib/urula/evolution';
import { convertColorNamesToHSL } from '../../../../src/lib/urula/colorMapping';
import type { UserUrulaProfile, EvolutionInput } from '../../../../src/types/urula';

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
    // 1. Add like to database
    const { error } = await supabase
      .from('likes')
      .upsert(
        {
          user_id: user.id,
          image_id: assetId
        },
        { onConflict: 'user_id,image_id' }
      );

    if (error) {
      console.error('[api/likes] upsert error:', error.message);
      return Response.json({ error: 'Failed to like asset' }, { status: 500 });
    }

    // 2. Fetch image metadata for evolution
    const { data: imageData } = await supabase
      .from('published_items')
      .select('tags, colors, category')
      .eq('id', assetId)
      .single();

    if (imageData) {
      // 3. Fetch current Urula profile
      const { data: profileData } = await supabase
        .from('user_urula_profile')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        // 4. Prepare evolution input from image metadata
        const styleTags = imageData.tags || [];
        const colors = convertColorNamesToHSL(imageData.colors || []);

        const evolutionInput: EvolutionInput = {
          styleTags,
          colors,
          signals: {
            liked: true, // Strong signal
          },
        };

        // 5. Evolve profile
        const evolvedProfile = evolveProfile(profileData as UserUrulaProfile, evolutionInput);

        // 6. Update profile in database
        await supabase
          .from('user_urula_profile')
          .update({
            mat_weights: evolvedProfile.mat_weights,
            glass_gene: evolvedProfile.glass_gene,
            chaos: evolvedProfile.chaos,
            tint: evolvedProfile.tint,
            palette: evolvedProfile.palette,
            history: evolvedProfile.history,
            updated_at: evolvedProfile.updated_at,
          })
          .eq('user_id', user.id);

        console.log('[api/likes] Profile evolved after like:', evolvedProfile.mat_weights);
      }
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
      .match({ user_id: user.id, image_id: assetId });

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

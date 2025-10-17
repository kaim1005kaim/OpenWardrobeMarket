export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import type { UserUrulaProfile, EvolutionInput } from '../../../../src/types/urula';
import { evolveProfile } from '../../../../src/lib/urula/evolution';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Evolve user's Urula profile based on generation results
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const input: EvolutionInput = await request.json();

    // Fetch current profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from('user_urula_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error('[api/urula/evolve] Fetch error:', fetchError);
      return Response.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Evolve profile
    const evolvedProfile = evolveProfile(currentProfile as UserUrulaProfile, input);

    // Save evolved profile
    const { data: savedProfile, error: saveError } = await supabase
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
      .eq('user_id', user.id)
      .select()
      .single();

    if (saveError) {
      console.error('[api/urula/evolve] Save error:', saveError);
      return Response.json({ error: 'Failed to save evolved profile' }, { status: 500 });
    }

    console.log('[api/urula/evolve] Profile evolved successfully for user:', user.id);

    return Response.json(savedProfile);
  } catch (error: any) {
    console.error('[api/urula/evolve] Error:', error);
    return Response.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import type { UserUrulaProfile } from '../../../../src/types/urula';
import { DEFAULT_URULA_PROFILE } from '../../../../src/types/urula';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get user's Urula profile
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch profile
    const { data, error } = await supabase
      .from('user_urula_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[api/urula/profile] GET error:', error);
      return Response.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // If no profile exists, create default one
    if (!data) {
      const defaultProfile: Omit<UserUrulaProfile, 'updated_at'> = {
        user_id: user.id,
        ...DEFAULT_URULA_PROFILE,
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('user_urula_profile')
        .insert(defaultProfile)
        .select()
        .single();

      if (insertError) {
        console.error('[api/urula/profile] INSERT error:', insertError);
        return Response.json({ error: 'Failed to create profile' }, { status: 500 });
      }

      return Response.json(newProfile);
    }

    return Response.json(data);
  } catch (error: any) {
    console.error('[api/urula/profile] GET error:', error);
    return Response.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * Patch user's Urula profile (partial update)
 */
export async function PATCH(request: Request) {
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

    const body = await request.json();

    // Update profile
    const { data, error } = await supabase
      .from('user_urula_profile')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[api/urula/profile] PATCH error:', error);
      return Response.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error: any) {
    console.error('[api/urula/profile] PATCH error:', error);
    return Response.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

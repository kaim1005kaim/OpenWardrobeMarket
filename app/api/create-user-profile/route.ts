export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  if (!SUPABASE_URL) {
    return Response.json({ error: 'Supabase URL not configured' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => null);
    const { userId, username, email } = body ?? {};

    if (!userId || !username || !email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === 'undefined') {
      console.error('Service role key not configured');
      return Response.json({
        success: true,
        warning: 'Profile creation skipped - service key not configured',
        data: { id: userId, username, email }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfile) {
      console.log('Profile already exists for user:', userId);
      return Response.json({ success: true, data: existingProfile });
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        username,
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Profile creation error:', error);
      return Response.json({
        success: true,
        warning: `Profile creation failed: ${error.message}`,
        data: { id: userId, username, email }
      });
    }

    return Response.json({ success: true, data });
  } catch (error: any) {
    console.error('Server error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

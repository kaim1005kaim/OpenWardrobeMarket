// app/api/dna-sync/route.ts
export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

// Supabase Admin Client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    // 1. Get user from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'No authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized', details: userError?.message }, { status: 401 });
    }

    // 2. Get payload from request body
    const {
      sessionKey,
      answers,
      freeText,
      geminiTags,
      dna,
      promptPreview
    } = await req.json();

    if (!sessionKey || !dna) {
      return Response.json({ error: 'sessionKey and dna are required' }, { status: 400 });
    }

    // 3. Prepare data for upsert
    const sessionData = {
      user_id: user.id,
      session_key: sessionKey,
      answers: answers ?? null,
      free_text: freeText ?? null,
      gemini_tags: geminiTags ?? null,
      dna: dna,
      prompt_preview: promptPreview ?? null,
      updated_at: new Date(),
    };

    // 4. Upsert into dna_sessions table
    const { error: upsertError } = await supabaseAdmin
      .from('dna_sessions')
      .upsert(sessionData, { onConflict: 'user_id, session_key' });

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      return Response.json({ error: 'Failed to sync DNA session', details: upsertError.message }, { status: 500 });
    }

    // 5. Respond with success
    return Response.json({ ok: true, message: 'DNA session synced' });

  } catch (e: any) {
    console.error('Unexpected error in /api/dna/sync:', e);
    return Response.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
  }
}

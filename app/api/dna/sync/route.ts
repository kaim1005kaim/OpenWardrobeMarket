export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionKey, answers, freeText, geminiTags, dna, promptPreview } = body;

    if (!sessionKey || !dna) {
      return NextResponse.json(
        { error: 'sessionKey and dna are required' },
        { status: 400 }
      );
    }

    console.log('[dna/sync] Upserting session:', {
      user_id: user.id,
      sessionKey,
      dna,
    });

    // Upsert DNA session
    const { error: upsertError } = await supabase.from('dna_sessions').upsert(
      {
        user_id: user.id,
        session_key: sessionKey,
        answers: answers || null,
        free_text: freeText || null,
        gemini_tags: geminiTags || null,
        dna,
        prompt_preview: promptPreview || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,session_key',
      }
    );

    if (upsertError) {
      console.error('[dna/sync] Upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save DNA session: ' + upsertError.message },
        { status: 500 }
      );
    }

    console.log('[dna/sync] Session saved successfully');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[dna/sync] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

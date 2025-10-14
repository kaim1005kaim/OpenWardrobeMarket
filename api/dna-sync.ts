import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin Client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Get user from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized', details: userError?.message });
    }

    // 2. Get payload from request body
    const {
      sessionKey,
      answers,
      freeText,
      geminiTags,
      dna,
      promptPreview
    } = req.body;

    if (!sessionKey || !dna) {
      return res.status(400).json({ error: 'sessionKey and dna are required' });
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
      return res.status(500).json({ error: 'Failed to sync DNA session', details: upsertError.message });
    }

    // 5. Respond with success
    return res.status(200).json({ ok: true, message: 'DNA session synced' });

  } catch (e: any) {
    console.error('Unexpected error in /api/dna/sync:', e);
    return res.status(500).json({ error: 'Internal Server Error', details: e.message });
  }
}

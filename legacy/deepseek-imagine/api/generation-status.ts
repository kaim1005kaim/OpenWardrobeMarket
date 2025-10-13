import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid id parameter' });
    }

    // Supabase Auth
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      console.error('[Generation Status] Auth error:', userErr);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // generation_historyからステータスとURLを取得
    const { data: generation, error: fetchErr } = await supabase
      .from('generation_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !generation) {
      console.error('[Generation Status] Fetch error:', fetchErr);
      return res.status(404).json({ error: 'Generation not found' });
    }

    return res.status(200).json({
      id: generation.id,
      status: generation.completion_status,
      url: generation.r2_url,
      external_id: generation.external_id,
      created_at: generation.created_at,
      completed_at: generation.completed_at,
    });
  } catch (e: any) {
    console.error('[Generation Status] Error:', e);
    return res.status(500).json({ error: e?.message || 'Failed to fetch status' });
  }
}

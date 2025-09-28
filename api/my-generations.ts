import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { user_id, id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id parameter required' });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    if (req.method === 'GET') {
      // Get user's generations
      const { data, error } = await supabase
        .from('user_generations')
        .select('*')
        .eq('user_id', user_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[My Generations] Query error:', error);
        return res.status(500).json({ error: 'Failed to fetch generations' });
      }

      return res.json({
        success: true,
        generations: data || []
      });

    } else if (req.method === 'DELETE' && id) {
      // Soft delete a generation
      const { error } = await supabase
        .from('user_generations')
        .update({ 
          is_deleted: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .eq('user_id', user_id);

      if (error) {
        console.error('[My Generations] Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete generation' });
      }

      return res.json({ success: true });

    } else if (req.method === 'PATCH' && id) {
      // Update generation (e.g., make public/private, update title)
      const { title, is_public } = req.body;
      
      const updates: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (is_public !== undefined) updates.is_public = is_public;

      const { error } = await supabase
        .from('user_generations')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user_id);

      if (error) {
        console.error('[My Generations] Update error:', error);
        return res.status(500).json({ error: 'Failed to update generation' });
      }

      return res.json({ success: true });

    } else {
      res.setHeader('Allow', ['GET', 'DELETE', 'PATCH']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

  } catch (error) {
    console.error('[My Generations] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
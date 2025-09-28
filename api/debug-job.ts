import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  
  if (!jobId) {
    return res.status(400).json({ error: 'jobId parameter required' });
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

    // Get task mapping
    const { data: mapping } = await supabase
      .from('imagine_task_map')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle();

    // Get all events for this job
    const { data: events } = await supabase
      .from('event_log')
      .select('*')
      .eq('job_id', jobId)
      .order('id', { ascending: true });

    // Get generation assets if any exist
    const { data: assets } = await supabase
      .from('generation_assets')
      .select('*')
      .eq('job_id', jobId);

    return res.json({
      jobId,
      mapping,
      events: events || [],
      assets: assets || [],
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Debug Job] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
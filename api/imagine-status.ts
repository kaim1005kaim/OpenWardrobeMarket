// ImagineAPI status polling endpoint
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const IMAGINE_API_TOKEN = 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';
const IMAGINE_API_BASE = 'https://cl.imagineapi.dev';

// Supabase client
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageId, jobId } = req.query;
  
  if (!imageId || !jobId) {
    return res.status(400).json({ error: 'imageId and jobId are required' });
  }

  try {
    console.log('[Status] Checking ImagineAPI status for:', imageId);
    
    // Get status from ImagineAPI
    const statusResponse = await fetch(`${IMAGINE_API_BASE}/items/images/${imageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!statusResponse.ok) {
      console.error('[Status] ImagineAPI error:', statusResponse.status);
      return res.status(500).json({ error: 'Failed to get status from ImagineAPI' });
    }

    const statusData = await statusResponse.json();
    const imageData = statusData.data;
    
    console.log('[Status] ImagineAPI response:', {
      id: imageData.id,
      status: imageData.status,
      progress: imageData.progress,
      hasUrl: !!imageData.url,
      hasUpscaled: !!imageData.upscaled_urls
    });

    // Check if we already processed this status
    const { data: existingEvents } = await supabase
      .from('event_log')
      .select('event_type')
      .eq('job_id', jobId as string)
      .eq('image_id', imageId as string);

    const hasProgress = existingEvents?.some(e => e.event_type === 'progress');
    const hasCompleted = existingEvents?.some(e => e.event_type === 'completed');

    // Save status to event_log if it's new
    if (imageData.status === 'completed' && !hasCompleted) {
      console.log('[Status] Saving completed event to database');
      
      // Parse URLs from the response
      const resultUrls = [];
      if (imageData.url) {
        resultUrls.push(imageData.url);
      }
      
      const { error: insertError } = await supabase
        .from('event_log')
        .insert({
          job_id: jobId as string,
          image_id: imageId as string,
          ext_id: `${imageId}-completed-${Date.now()}`,
          event_type: 'completed',
          result_urls: resultUrls,
          upscaled_urls: imageData.upscaled_urls || [],
          payload: imageData,
          processed: false,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Status] Failed to save completed event:', insertError);
      } else {
        console.log('[Status] Completed event saved successfully');
      }
    } else if (imageData.status === 'in-progress' && imageData.progress && !hasProgress) {
      console.log('[Status] Saving progress event to database');
      
      const { error: insertError } = await supabase
        .from('event_log')
        .insert({
          job_id: jobId as string,
          image_id: imageId as string,
          ext_id: `${imageId}-progress-${Date.now()}`,
          event_type: 'progress',
          progress: imageData.progress,
          preview_url: imageData.url || null,
          payload: imageData,
          processed: false,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Status] Failed to save progress event:', insertError);
      }
    }

    // Return current status
    res.status(200).json({
      id: imageData.id,
      status: imageData.status,
      progress: imageData.progress,
      url: imageData.url,
      upscaled_urls: imageData.upscaled_urls,
      ref: imageData.ref
    });
    
  } catch (error) {
    console.error('[Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to check status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
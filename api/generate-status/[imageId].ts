import type { NextApiRequest, NextApiResponse } from 'next';

const IMAGINE_API_TOKEN = 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';
const IMAGINE_API_BASE = 'https://cl.imagineapi.dev';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageId } = req.query as { imageId: string };

  if (!imageId) {
    return res.status(400).json({ error: 'Image ID required' });
  }

  try {
    console.log(`[GenerateStatus] Checking status for image: ${imageId}`);

    const statusResponse = await fetch(`${IMAGINE_API_BASE}/items/images/${imageId}`, {
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_TOKEN}`
      }
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error(`[GenerateStatus] API Error:`, {
        status: statusResponse.status,
        error: errorText
      });
      
      return res.status(statusResponse.status).json({ 
        error: 'Failed to check status',
        details: errorText
      });
    }

    const statusData = await statusResponse.json();
    console.log(`[GenerateStatus] Status:`, {
      imageId,
      status: statusData.data.status,
      progress: statusData.data.progress
    });

    // Transform response to match expected format
    const response: any = {
      success: true,
      imageId,
      status: statusData.data.status,
      progress: statusData.data.progress || 0
    };

    if (statusData.data.status === 'completed') {
      // Include completed images if available
      if (statusData.data.upscaled_urls && statusData.data.upscaled_urls.length > 0) {
        response.images = statusData.data.upscaled_urls.map((url: string, index: number) => ({
          url,
          id: `${imageId}-${index}`,
          index
        }));
      } else if (statusData.data.url) {
        response.images = [{
          url: statusData.data.url,
          id: imageId,
          index: 0
        }];
      }
    } else if (statusData.data.status === 'failed') {
      response.error = statusData.data.error || 'Generation failed';
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('[GenerateStatus] Error:', error);
    res.status(500).json({ 
      error: 'Status check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
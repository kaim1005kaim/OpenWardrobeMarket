import type { VercelRequest, VercelResponse } from '@vercel/node';

// 手動でWebhookをテストするためのエンドポイント
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    // ImagineAPIから現在のステータスを取得
    const IMAGINE_API_KEY = process.env.IMAGINE_API_KEY || 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';

    const response = await fetch(`https://cl.imagineapi.dev/items/images/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${IMAGINE_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`ImagineAPI error: ${response.status}`);
    }

    const data = await response.json();

    // Webhookエンドポイントを呼び出す
    const webhookPayload = {
      event: 'images.items.update',
      payload: data.data || data
    };

    const webhookResponse = await fetch(`${req.headers.origin || 'https://open-wardrobe-market.vercel.app'}/api/imagine-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    const webhookResult = await webhookResponse.json();

    return res.status(200).json({
      success: true,
      imagineApiData: data,
      webhookResult
    });

  } catch (error: any) {
    console.error('[Test Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

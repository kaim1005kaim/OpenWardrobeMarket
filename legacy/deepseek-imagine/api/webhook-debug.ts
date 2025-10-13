import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Debug] Webhook called:', {
    method: req.method,
    headers: Object.keys(req.headers),
    body: req.body,
  });

  try {
    // 即座に成功レスポンス
    res.status(200).json({ 
      success: true, 
      received: req.body,
      timestamp: Date.now() 
    });

    console.log('[Debug] Response sent successfully');
  } catch (error) {
    console.error('[Debug] Error:', error);
    res.status(500).json({ error: 'Debug webhook error' });
  }
}
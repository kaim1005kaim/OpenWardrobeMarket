import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // 現在は保存機能は実装されていないため、空の配列を返す
    res.status(200).json({ 
      success: true, 
      items: [],
      message: 'Saved items feature coming soon'
    });
  } catch (error) {
    console.error('[Saved API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch saved items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
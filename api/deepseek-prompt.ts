import type { NextApiRequest, NextApiResponse } from 'next';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-66f706b0a1784a57b8e57affcd9265c8';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, user } = req.body;

  if (!system || !user) {
    return res.status(400).json({ error: 'System and user messages required' });
  }

  try {
    console.log('[DeepSeek] Generating prompt with:', { user });

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DeepSeek] API Error:', {
        status: response.status,
        error: errorText
      });
      return res.status(response.status).json({ 
        error: 'DeepSeek API error',
        details: errorText
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in DeepSeek response');
    }

    // JSONとしてパース
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[DeepSeek] Parse error:', parseError);
      // テキストレスポンスの場合はそのまま返す
      result = { prompt: content };
    }

    console.log('[DeepSeek] Generated result:', result);

    res.status(200).json({ success: true, result });

  } catch (error) {
    console.error('[DeepSeek] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
import type { NextApiRequest, NextApiResponse } from 'next';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1/chat/completions';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface DesignParams {
  vibe?: string;
  silhouette?: string;
  palette?: string;
  personalStyle?: string;
  occasion?: string;
  referenceImage?: any;
}

const SYSTEM_PROMPT = `You are a friendly AI fashion designer assistant helping users create personalized fashion designs. 

RULES:
- Keep conversations short and engaging (2-3 questions max)
- Always aim for single full-body model designs
- Exclude logos, text, or brand elements
- Use aspect ratio 2:3 for fashion portraits
- Collect: vibe, silhouette, palette, and personal style preferences
- Generate final Midjourney prompt after collecting enough info

CONVERSATION FLOW:
1. Start with vibe/mood (minimal, street, elegant, casual, avant-garde)
2. Ask about silhouette/fit (oversized, tailored, flowing, structured)
3. Discuss color palette (neutral, bold, pastel, monochrome)
4. Optional: occasion or personal touch

RESPONSE FORMAT:
Return JSON with:
{
  "message": "Your conversational response",
  "options": ["option1", "option2", "option3"] (optional quick replies),
  "updatedParams": {"vibe": "value"} (parameters to update),
  "nextStep": number (0-3, current conversation step),
  "readyToGenerate": boolean (true when ready to generate),
  "finalPrompt": "Midjourney prompt" (only when ready)
}

PROMPT TEMPLATE when ready:
"A full-body shot of a single model wearing [vibe] [silhouette] in [palette] colors, [occasion] outfit, fashion photography, professional lighting, clean background --ar 2:3 --no multiple people, group photo, logo, text, brand"`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, designParams, step, user_id } = req.body;

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured' });
  }

  try {
    console.log('[Chat] Processing request:', {
      step,
      designParams,
      lastMessage: messages[messages.length - 1]?.content
    });

    // システムプロンプトと会話履歴を準備
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(-4), // 最後の4メッセージのみ保持（コスト削減）
      {
        role: 'system',
        content: `Current design parameters: ${JSON.stringify(designParams)}. Current step: ${step}/3. User ID: ${user_id || 'anonymous'}`
      }
    ];

    // DeepSeek APIコール
    const response = await fetch(DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const result = await response.json();
    const aiResponse = JSON.parse(result.choices[0].message.content);

    console.log('[Chat] DeepSeek response:', aiResponse);

    // レスポンス検証と整形
    const formattedResponse = {
      success: true,
      message: aiResponse.message || 'すみません、もう一度お試しください。',
      options: aiResponse.options || [],
      updatedParams: aiResponse.updatedParams || {},
      nextStep: Math.min(aiResponse.nextStep || step + 1, 3),
      readyToGenerate: aiResponse.readyToGenerate || false,
      finalPrompt: aiResponse.finalPrompt || ''
    };

    // 生成準備完了の場合、最終プロンプトを検証・補強
    if (formattedResponse.readyToGenerate && formattedResponse.finalPrompt) {
      const enhancedPrompt = enhancePrompt(formattedResponse.finalPrompt, designParams);
      formattedResponse.finalPrompt = enhancedPrompt;
    }

    res.status(200).json(formattedResponse);

  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Chat processing failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

function enhancePrompt(prompt: string, params: DesignParams): string {
  let enhanced = prompt;

  // 必須要素の強制追加
  if (!enhanced.includes('single model')) {
    enhanced = `A full-body shot of a single model wearing ${enhanced}`;
  }

  // アスペクト比の強制
  if (!enhanced.includes('--ar')) {
    enhanced += ' --ar 2:3';
  }

  // ネガティブプロンプトの強制
  if (!enhanced.includes('--no')) {
    enhanced += ' --no multiple people, group photo, logo, text, brand, watermark';
  }

  // パラメータ不足の補完
  if (params.vibe && !enhanced.toLowerCase().includes(params.vibe.toLowerCase())) {
    enhanced = enhanced.replace('wearing ', `wearing ${params.vibe} `);
  }

  if (params.palette && !enhanced.toLowerCase().includes('color')) {
    enhanced = enhanced.replace(' --ar', ` in ${params.palette} colors --ar`);
  }

  // 品質向上パラメータ
  enhanced += ' --v 6 --style raw';

  console.log('[Chat] Enhanced prompt:', enhanced);
  return enhanced;
}
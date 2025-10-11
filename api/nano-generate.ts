import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, negative, aspectRatio = '3:4', answers } = req.body;

    // 1) Supabase Auth
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
      console.error('[Nano Generate] Auth error:', userErr);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Nano Generate] User authenticated:', user.id);

    // 2) ImagineAPI呼び出し
    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography`;

    console.log('[Nano Generate] Generating with prompt:', fullPrompt);

    const payload = {
      prompt: fullPrompt
    };

    const IMAGINE_API_KEY = process.env.IMAGINE_API_KEY || 'imgn_suoc6eez6gfqlb2ke3jpniae2hi6akos';

    const response = await fetch('https://cl.imagineapi.dev/items/images/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${IMAGINE_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      throw new Error(`ImagineAPI error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const result: any = await response.json();

    console.log('[Nano Generate] ImagineAPI response:', JSON.stringify(result));

    // ImagineAPIは非同期で処理されるため、task IDを取得
    const taskId = result.data?.id || result.id;

    if (!taskId) {
      console.error('[Nano Generate] No task ID in response:', JSON.stringify(result));
      throw new Error('No task ID returned from ImagineAPI');
    }

    console.log('[Nano Generate] Task created:', taskId);

    // 3) Supabase履歴Insert（pending状態で作成、webhookで更新される）
    const { data: row, error: insErr } = await supabase
      .from('generation_history')
      .insert({
        user_id: user.id,
        provider: 'imagineapi',
        model: 'midjourney',
        prompt: fullPrompt,
        negative_prompt: negative,
        aspect_ratio: aspectRatio,
        external_id: taskId,
        folder: 'usergen',
        mode: 'mobile-simple',
        generation_data: answers ?? null,
        completion_status: 'pending',
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Nano Generate] DB insert error:', insErr);
      throw insErr;
    }

    console.log('[Nano Generate] Saved to DB:', row.id, 'task:', taskId);

    // Webhookで画像が完成したら自動的にURLが更新される
    return res.status(200).json({
      id: row.id,
      taskId: taskId,
      status: 'pending',
      message: 'Generation started. Webhook will update when complete.'
    });
  } catch (e: any) {
    console.error('[Nano Generate] Error:', e);
    return res.status(500).json({ error: e?.message || 'Generation failed' });
  }
}

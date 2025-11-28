import { Router } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const router = Router();

// 認証付きでユーザーを見る用（フロントから Authorization: Bearer <access_token> が来る前提）
function supabaseForAuth(token?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // anonでOK
    {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      auth: { persistSession: false },
    }
  );
}

// DB書き込み（Service Role）用。※サーバ内だけで使うこと
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 絶対にフロントへ出さない
  { auth: { persistSession: false } }
);

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

router.post("/nano-generate", async (req, res) => {
  try {
    const { prompt, negative, aspectRatio = "3:4", answers } = req.body as {
      prompt: string; negative?: string; aspectRatio?: string; answers?: any;
    };

    // --- 認証ユーザー取得 ---
    const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const supaAuth = supabaseForAuth(token);
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) return res.status(401).json({ error: "unauthorized" });

    console.log('[Nano Banana] Generating image for user:', user.id);

    // --- 画像生成（Nano Banana）REST API直接呼び出し ---
    const fullPrompt = `${prompt}${negative ? `. ${negative}` : ""}`;
    console.log('[Nano Banana] Prompt:', fullPrompt);

    // Use REST API instead of SDK
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GOOGLE_API_KEY!}`;

    const fetchResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }],
        }],
        generationConfig: {
          imageConfig: { aspectRatio }
        },
      }),
    });

    if (!fetchResp.ok) {
      const errorText = await fetchResp.text();
      console.error('[Nano Banana] Google AI API error:', errorText);
      return res.status(500).json({ error: `Google AI API error: ${fetchResp.status}` });
    }

    const resp = await fetchResp.json();
    const parts: any[] = resp.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find(p => p.inlineData)?.inlineData;
    if (!inline?.data) {
      console.error('[Nano Banana] No image data in response');
      return res.status(500).json({ error: "no-image" });
    }

    const mime = inline.mimeType || "image/png";
    const ext = mime.includes("webp") ? "webp" : "png";
    const buffer = Buffer.from(inline.data, "base64");

    // --- R2 保存（usergen/{uid}/yyyy/mm/...） ---
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}.${ext}`;

    console.log('[Nano Banana] Uploading to R2:', key);

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

    // --- 履歴記録（generation_history） ---
    const { data: row, error: insErr } = await supabaseAdmin
      .from("generation_history")
      .insert({
        user_id: user.id,
        provider: "gemini",
        model: "gemini-2.5-flash-image",
        prompt,
        negative_prompt: negative,
        aspect_ratio: aspectRatio,
        image_bucket: R2_BUCKET,
        image_path: key,
        image_url: publicUrl,        // 公開運用ならそのまま／非公開運用なら署名URLに切替
        folder: "usergen",
        mode: "mobile-simple",
        generation_data: answers ?? null,
        completion_status: "completed",
      })
      .select()
      .single();

    if (insErr) {
      console.error('[Nano Banana] Insert error:', insErr);
      throw insErr;
    }

    console.log('[Nano Banana] Generation complete:', row.id);
    return res.json({ id: row.id, url: publicUrl, path: key });
  } catch (e: any) {
    // 429などのレート系はそのまま返す
    console.error('[Nano Banana] Error:', e);
    const msg = e?.message || "failed";
    return res.status(500).json({ error: msg });
  }
});

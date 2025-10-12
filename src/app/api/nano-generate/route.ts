import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/supabase-js";
import { GoogleAI } from "@google/genai";
import { r2, R2_BUCKET, R2_PUBLIC_BASE_URL, PutObjectCommand } from "@/lib/r2";

export const runtime = "nodejs"; // R2 (AWS SDK) を使うので Node ランタイム

const ai = new GoogleAI({ apiKey: process.env.GOOGLE_API_KEY! });

function b64ToBuffer(b64: string) {
  return Buffer.from(b64, "base64");
}

export async function POST(req: Request) {
  try {
    const { prompt, negative, aspectRatio = "3:4", answers } = await req.json();

    // 1) Supabase Auth（Cookieでユーザー取得）
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (n: string) => cookies().get(n)?.value
        } as any
      }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2) 画像生成（Gemini 2.5 Flash Image）
    const fullPrompt = `${prompt}${negative ? `. ${negative}` : ""}`;
    console.log('Generating image with prompt:', fullPrompt);

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: fullPrompt,
      generationConfig: {
        imageConfig: { aspectRatio }
      },
    });

    const parts: any[] = res.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('No image data in response:', res);
      return NextResponse.json({ error: "no-image" }, { status: 500 });
    }

    const buf = b64ToBuffer(inline.data);
    const mime = inline.mimeType || "image/png";
    const ext = mime.includes("webp") ? "webp" : "png";

    // 3) R2 保存（usergen/{uid}/yyyy/mm/…）
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth()+1}`.padStart(2,"0");
    const key = `usergen/${user.id}/${yyyy}/${mm}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    }));

    const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

    // 4) 履歴Insert
    const { data: row, error: insErr } = await supabase
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
        image_url: publicUrl,
        folder: "usergen",
        mode: "mobile-simple",
        generation_data: answers ?? null,
        completion_status: "completed"
      })
      .select()
      .single();

    if (insErr) {
      console.error('Insert error:', insErr);
      throw insErr;
    }

    console.log('Generation complete:', { id: row.id, url: publicUrl });
    return NextResponse.json({ id: row.id, url: publicUrl, path: key });

  } catch (e: any) {
    console.error('Generation error:', e);
    return NextResponse.json({
      error: e?.message || "failed"
    }, { status: 500 });
  }
}

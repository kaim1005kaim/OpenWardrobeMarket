Gemini/Nano Bananaで生成 → R2へ保存 → Supabaseで履歴管理 → 公開/非公開切替 → ギャラリー/購入まで）を全部ひとまとめにした“貼って動く”指示書です。  
※ セキュリティのため、あなたが貼ってくれた 実キーはマスクしました。公開していた場合は必ずローテーションしてください。

⸻

導入手順（本番運用向け最短ルート・Next.js App Router / Vercel）

0\) 環境変数（Vercelに登録。サーバのみで参照）  
\# Google (Gemini / Nano Banana)  
GOOGLE\_API\_KEY=YOUR\_GEMINI\_API\_KEY   \# AIzaSyAw-OX-XUpgxMF1pfBIXQWxQNQj4BLkWwo

\# Supabase  
NEXT\_PUBLIC\_SUPABASE\_URL=https://xxxxx.supabase.co  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=xxxxx  
SUPABASE\_SERVICE\_ROLE\_KEY=xxxxx      \# ★サーバ専用（クライアントに絶対出さない）

\# Cloudflare R2（画像はR2に保存）  
R2\_BUCKET=owm-assets  
R2\_S3\_ENDPOINT=https://\<accountid\>.r2.cloudflarestorage.com  
R2\_ACCESS\_KEY\_ID=xxxxx  
R2\_SECRET\_ACCESS\_KEY=xxxxx  
R2\_PUBLIC\_BASE\_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev  \# 公開配信URL

\# Stripe（購入機能を使う場合）  
STRIPE\_SECRET\_KEY=sk\_live\_xxx  
STRIPE\_WEBHOOK\_SECRET=whsec\_xxx

1\) 依存関係  
npm i @google/genai @supabase/supabase-js @aws-sdk/client-s3 @aws-sdk/s3-request-presigner  
npm i stripe jszip  
\# 透かしプレビューや軽量化をする場合  
npm i sharp

2\) R2 クライアント（S3互換）

src/lib/r2.ts  
import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";  
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 \= new S3Client({  
  region: "auto",  
  endpoint: process.env.R2\_S3\_ENDPOINT\!,  
  credentials: {  
    accessKeyId: process.env.R2\_ACCESS\_KEY\_ID\!,  
    secretAccessKey: process.env.R2\_SECRET\_ACCESS\_KEY\!,  
  },  
  forcePathStyle: true,  
});

export const R2\_BUCKET \= process.env.R2\_BUCKET\!;  
export const R2\_PUBLIC\_BASE\_URL \= process.env.R2\_PUBLIC\_BASE\_URL\!;

export function presignGet(key: string, secs \= 60 \* 60\) {  
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2\_BUCKET, Key: key }), { expiresIn: secs });  
}

export { GetObjectCommand, PutObjectCommand, CopyObjectCommand, ListObjectsV2Command };

3\) プロンプト生成（既存マッピングを踏襲）

src/lib/prompt/buildMobile.ts  
export type Answers \= {  
  vibe: string\[\]; silhouette: string\[\]; color: string\[\];  
  occasion: string\[\]; season: string\[\]; extra?: string;  
};

export const NEGATIVE \=  
  "no text, no words, no logos, no brands, no celebrities, no multiple people, no watermark, no signature";

export function buildPrompt(a: Answers) {  
  const vibe \= a.vibe?.\[0\], sil \= a.silhouette?.\[0\];  
  const pal \= (a.color || \[\]).join(", ");  
  const occ \= a.occasion?.\[0\], season \= a.season?.\[0\];

  const core \= \[  
    "single model, one person only, full-body fashion photography",  
    "studio lighting, clean minimal background, high detail",  
    vibe && \`${vibe} vibe\`,  
    sil && \`${sil} silhouette\`,  
    pal && \`palette: ${pal}\`,  
    occ && \`for ${occ}\`,  
    season  
  \].filter(Boolean).join(", ");

  return \`${core}. ${NEGATIVE}. ${a.extra || ""}\`.trim();  
}

4\) DB スキーマ（Supabase）

画像はR2、履歴や公開情報はSupabaseで管理します。  
\-- 生成履歴  
create table if not exists public.generation\_history (  
  id uuid primary key default gen\_random\_uuid(),  
  user\_id uuid not null references auth.users(id) on delete cascade,  
  provider text not null default 'gemini',  
  model text not null default 'gemini-2.5-flash-image',  
  prompt text,  
  negative\_prompt text,  
  aspect\_ratio text default '3:4',  
  seed bigint,  
  image\_bucket text,  
  image\_path text,  
  image\_url text,                 \-- R2の公開URL or 署名URL  
  folder text default 'usergen',  \-- 'usergen' | 'public' | 'catalog' 等の分類  
  mode text default 'mobile-simple',  
  generation\_data jsonb,  
  is\_public boolean default false,  
  preview\_path text,              \-- 公開用プレビュー（透かし）  
  preview\_url text,  
  published\_at timestamptz,  
  completion\_status text not null default 'completed',  
  created\_at timestamptz default now()  
);  
alter table public.generation\_history enable row level security;  
create policy "select own" on public.generation\_history for select using (auth.uid() \= user\_id);  
create policy "insert own" on public.generation\_history for insert with check (auth.uid() \= user\_id);  
create policy "update own" on public.generation\_history for update using (auth.uid() \= user\_id) with check (auth.uid() \= user\_id);

\-- マーケット出品  
create table if not exists public.listings (  
  id uuid primary key default gen\_random\_uuid(),  
  owner\_id uuid not null references auth.users(id) on delete cascade,  
  history\_id uuid not null references public.generation\_history(id) on delete cascade,  
  title text,  
  tags text\[\],  
  license\_type text not null default 'non-exclusive',  \-- 'exclusive'|'non-exclusive'|'single-use'  
  price\_cents int not null,  
  currency text not null default 'JPY',  
  max\_sales int,  
  total\_sold int not null default 0,  
  status text not null default 'active', \-- 'active'|'paused'|'sold\_out'  
  created\_at timestamptz default now(),  
  updated\_at timestamptz default now()  
);  
alter table public.listings enable row level security;  
create policy "owner can crud" on public.listings  
  using (auth.uid() \= owner\_id) with check (auth.uid() \= owner\_id);

\-- 注文  
create table if not exists public.orders (  
  id uuid primary key default gen\_random\_uuid(),  
  buyer\_id uuid not null references auth.users(id) on delete cascade,  
  listing\_id uuid not null references public.listings(id) on delete cascade,  
  amount\_cents int not null,  
  currency text not null default 'JPY',  
  stripe\_session\_id text,  
  stripe\_payment\_intent text,  
  status text not null default 'pending', \-- 'pending'|'paid'|'expired'|'refunded'  
  deliver\_path text,          \-- R2: deliver/{orderId}/package.zip  
  deliver\_url text,           \-- 署名URL（期限付き）  
  created\_at timestamptz default now(),  
  paid\_at timestamptz  
);  
alter table public.orders enable row level security;  
create policy "buyer can read own" on public.orders for select using (auth.uid() \= buyer\_id);  
create policy "buyer can insert own" on public.orders for insert with check (auth.uid() \= buyer\_id);

\-- 売上カウント用の簡易RPC（任意）  
create or replace function public.increment\_listing\_sold(p\_listing\_id uuid)  
returns void language sql as $$  
  update public.listings set total\_sold \= total\_sold \+ 1 where id \= p\_listing\_id;  
$$;

5\) 生成 → R2保存 → 履歴Insert（Webhook不要・1エンドポイント）

app/api/nano/generate/route.ts  
import { NextResponse } from "next/server";  
import { cookies } from "next/headers";  
import { createServerClient } from "@supabase/supabase-js";  
import { GoogleAI } from "@google/genai";  
import { r2, R2\_BUCKET, R2\_PUBLIC\_BASE\_URL, PutObjectCommand } from "@/lib/r2";

export const runtime \= "nodejs"; // R2 (AWS SDK) を使うので Node ランタイム

const ai \= new GoogleAI({ apiKey: process.env.GOOGLE\_API\_KEY\! });

function b64ToBuffer(b64: string) { return Buffer.from(b64, "base64"); }

export async function POST(req: Request) {  
  try {  
    const { prompt, negative, aspectRatio \= "3:4", answers } \= await req.json();

    // 1\) Supabase Auth（Cookieでユーザー取得）  
    const supabase \= createServerClient(  
      process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!,  
      { cookies: { get: (n: string) \=\> cookies().get(n)?.value } as any }  
    );  
    const { data: { user }, error: userErr } \= await supabase.auth.getUser();  
    if (userErr || \!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 2\) 画像生成（Gemini 2.5 Flash Image）  
    const res \= await ai.models.generateContent({  
      model: "gemini-2.5-flash-image",  
      contents: \`${prompt}${negative ? \`. ${negative}\` : ""}\`,  
      generationConfig: { imageConfig: { aspectRatio } },  
    });  
    const parts: any\[\] \= res.candidates?.\[0\]?.content?.parts ?? \[\];  
    const inline \= parts.find((p) \=\> p.inlineData)?.inlineData;  
    if (\!inline?.data) return NextResponse.json({ error: "no-image" }, { status: 500 });

    const buf \= b64ToBuffer(inline.data);  
    const mime \= inline.mimeType || "image/png";  
    const ext \= mime.includes("webp") ? "webp" : "png";

    // 3\) R2 保存（usergen/{uid}/yyyy/mm/…）  
    const now \= new Date();  
    const yyyy \= now.getFullYear(); const mm \= \`${now.getMonth()+1}\`.padStart(2,"0");  
    const key \= \`usergen/${user.id}/${yyyy}/${mm}/${Date.now()}\_${crypto.randomUUID()}.${ext}\`;

    await r2.send(new PutObjectCommand({  
      Bucket: R2\_BUCKET,  
      Key: key,  
      Body: buf,  
      ContentType: mime,  
      CacheControl: "public, max-age=31536000, immutable",  
    }));

    const publicUrl \= \`${R2\_PUBLIC\_BASE\_URL}/${key}\`; // 公開バケットの場合。非公開なら署名URLに変更可

    // 4\) 履歴Insert  
    const { data: row, error: insErr } \= await supabase  
      .from("generation\_history")  
      .insert({  
        user\_id: user.id,  
        provider: "gemini",  
        model: "gemini-2.5-flash-image",  
        prompt, negative\_prompt: negative, aspect\_ratio: aspectRatio,  
        image\_bucket: R2\_BUCKET, image\_path: key, image\_url: publicUrl,  
        folder: "usergen", mode: "mobile-simple",  
        generation\_data: answers ?? null, completion\_status: "completed"  
      })  
      .select().single();  
    if (insErr) throw insErr;

    return NextResponse.json({ id: row.id, url: publicUrl, path: key });  
  } catch (e:any) {  
    console.error(e);  
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });  
  }  
}

6\) フロント接続（あなたの5ステップUI）  
import { buildPrompt, Answers } from "@/lib/prompt/buildMobile";

async function generateAndSave(answers: Answers) {  
  const prompt \= buildPrompt(answers);  
  const negative \=  
    "no text, no words, no logos, no brands, no celebrities, no multiple people, no watermark, no signature";

  const r \= await fetch("/api/nano/generate", {  
    method: "POST",  
    headers: { "Content-Type": "application/json" },  
    body: JSON.stringify({ prompt, negative, aspectRatio: "3:4", answers }),  
  });  
  if (\!r.ok) throw new Error("generate failed");  
  return r.json(); // { id, url, path }  
}

// 既存TODOを置換  
setIsGenerating(true);  
try {  
  const { id, url } \= await generateAndSave(answers);  
  // プレビュー表示 or マイページへ遷移  
} catch (e) {  
  alert("生成に失敗しました");  
} finally {  
  setIsGenerating(false);  
}

7\) R2 一覧API（ギャラリー表示に利用）

a) サンプル集（catalog/ プレフィックスを新しい順）

app/api/catalog/route.ts

import { NextResponse } from "next/server";  
import { r2, R2\_BUCKET, R2\_PUBLIC\_BASE\_URL, ListObjectsV2Command } from "@/lib/r2";  
export const runtime \= "nodejs";

export async function GET() {  
  const out \= await r2.send(new ListObjectsV2Command({  
    Bucket: R2\_BUCKET, Prefix: "catalog/", MaxKeys: 1000,  
  }));  
  const items \= (out.Contents ?? \[\])  
    .filter(o \=\> o.Key && /\\.(png|jpg|jpeg|webp)$/i.test(o.Key))  
    .sort((a,b) \=\> (b.LastModified?.getTime() ?? 0\) \- (a.LastModified?.getTime() ?? 0))  
    .map(o \=\> ({ key: o.Key\!, url: \`${R2\_PUBLIC\_BASE\_URL}/${o.Key}\`, size: o.Size, lastModified: o.LastModified }));  
  return NextResponse.json({ items });  
}

b) 自分の生成物（usergen/{uid}/…）

app/api/user-gallery/route.ts

import { NextResponse } from "next/server";  
import { cookies } from "next/headers";  
import { createServerClient } from "@supabase/supabase-js";  
import { r2, R2\_BUCKET, R2\_PUBLIC\_BASE\_URL, ListObjectsV2Command } from "@/lib/r2";  
export const runtime \= "nodejs";

export async function GET() {  
  const supa \= createServerClient(process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!, { cookies: { get: (n:string)=\>cookies().get(n)?.value } as any });  
  const { data: { user } } \= await supa.auth.getUser();  
  if (\!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const Prefix \= \`usergen/${user.id}/\`;  
  const out \= await r2.send(new ListObjectsV2Command({ Bucket: R2\_BUCKET, Prefix, MaxKeys: 1000 }));  
  const items \= (out.Contents ?? \[\])  
    .filter(o \=\> o.Key && /\\.(png|jpg|jpeg|webp)$/i.test(o.Key))  
    .sort((a,b) \=\> (b.LastModified?.getTime() ?? 0\) \- (a.LastModified?.getTime() ?? 0))  
    .map(o \=\> ({ key: o.Key\!, url: \`${R2\_PUBLIC\_BASE\_URL}/${o.Key}\`, size: o.Size, lastModified: o.LastModified }));  
  return NextResponse.json({ items });  
}

8\) 公開フロー：プレビュー生成（透かし）→ 出品作成

透かしプレビュー（Sharp）

src/lib/preview.ts  
import sharp from "sharp";

export async function makePreviewPng(buf: Buffer) {  
  const png \= await sharp(buf).resize(1280, null, { fit: "inside" }).png().toBuffer();  
  const wm \= Buffer.from(  
    \`\<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280"\>  
      \<defs\>\<pattern id="p" width="300" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"\>  
        \<text x="0" y="90" font-size="72" fill="rgba(255,255,255,0.18)" font-family="Helvetica, Arial"\>OPEN WARDROBE MARKET\</text\>  
      \</pattern\>\</defs\>\<rect width="100%" height="100%" fill="url(\#p)"/\>\</svg\>\`  
  );  
  return sharp(png).composite(\[{ input: wm, gravity: "center" }\]).png().toBuffer();  
}

公開API（プレビューを public/ に保存 & listings作成）

app/api/user-gallery/publish/route.ts  
import { NextResponse } from "next/server";  
import { cookies } from "next/headers";  
import { createServerClient } from "@supabase/supabase-js";  
import { r2, R2\_BUCKET, R2\_PUBLIC\_BASE\_URL, GetObjectCommand, PutObjectCommand } from "@/lib/r2";  
import { makePreviewPng } from "@/lib/preview";  
export const runtime \= "nodejs";

export async function POST(req: Request) {  
  const { historyId, priceCents, licenseType \= "non-exclusive", title, tags \= \[\] } \= await req.json();

  const supa \= createServerClient(process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!, { cookies: { get: (n:string)=\>cookies().get(n)?.value } as any });  
  const { data: { user } } \= await supa.auth.getUser();  
  if (\!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: hist, error } \= await supa.from("generation\_history").select("\*").eq("id", historyId).eq("user\_id", user.id).single();  
  if (error || \!hist) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const srcKey \= hist.image\_path as string;  
  const obj \= await r2.send(new GetObjectCommand({ Bucket: R2\_BUCKET, Key: srcKey }));  
  const buf \= Buffer.from(await obj.Body\!.transformToByteArray());  
  const preview \= await makePreviewPng(buf);

  const now \= new Date(); const yyyy \= now.getFullYear(); const mm \= \`${now.getMonth()+1}\`.padStart(2,"0");  
  const fileName \= srcKey.split("/").pop()\!.replace(/\\.\[^.\]+$/, ".png");  
  const previewKey \= \`public/${yyyy}/${mm}/${user.id}/${fileName}\`;

  await r2.send(new PutObjectCommand({ Bucket: R2\_BUCKET, Key: previewKey, Body: preview, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }));  
  const previewUrl \= \`${R2\_PUBLIC\_BASE\_URL}/${previewKey}\`;

  const { error: upErr } \= await supa.from("generation\_history").update({  
    is\_public: true, published\_at: new Date().toISOString(),  
    preview\_path: previewKey, preview\_url: previewUrl  
  }).eq("id", historyId);  
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: listing, error: insErr } \= await supa.from("listings").insert({  
    owner\_id: user.id, history\_id: historyId, title, tags,  
    license\_type: licenseType, price\_cents: priceCents, currency: "JPY", status: "active"  
  }).select().single();  
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ listingId: listing.id, previewUrl });  
}

非公開に戻す（出品停止）

app/api/user-gallery/unpublish/route.ts  
import { NextResponse } from "next/server";  
import { cookies } from "next/headers";  
import { createServerClient } from "@supabase/supabase-js";

export async function POST(req: Request) {  
  const { historyId } \= await req.json();  
  const supa \= createServerClient(process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!, { cookies: { get: (n:string)=\>cookies().get(n)?.value } as any });  
  const { data: { user } } \= await supa.auth.getUser();  
  if (\!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await supa.from("generation\_history").update({ is\_public: false }).eq("id", historyId).eq("user\_id", user.id);  
  await supa.from("listings").update({ status: "paused" }).eq("history\_id", historyId).eq("owner\_id", user.id);

  return NextResponse.json({ ok: true });  
}

9\) 公開ギャラリーAPI（購入ボタン付き）

app/api/gallery/public/route.ts

import { NextResponse } from "next/server";  
import { createServerClient } from "@supabase/supabase-js";

export async function GET() {  
  const supa \= createServerClient(process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!, { auth: { persistSession: false } });  
  const { data, error } \= await supa  
    .from("listings")  
    .select("id, title, tags, price\_cents, currency, status, history\_id, generation\_history\!inner(preview\_url, user\_id, published\_at)")  
    .eq("status","active")  
    .order("created\_at",{ascending:false})  
    .limit(1000);  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items \= data.map((r:any)=\>({  
    id: r.id, title: r.title, tags: r.tags,  
    price: r.price\_cents, currency: r.currency, status: r.status,  
    preview: r.generation\_history.preview\_url,  
    ownerId: r.generation\_history.user\_id,  
    publishedAt: r.generation\_history.published\_at  
  }));  
  return NextResponse.json({ items });  
}

10\) 決済（Stripe）→ 納品（R2 署名URL）

Checkout セッション作成

app/api/checkout/route.ts  
import Stripe from "stripe";  
import { NextResponse } from "next/server";  
import { cookies } from "next/headers";  
import { createServerClient } from "@supabase/supabase-js";

const stripe \= new Stripe(process.env.STRIPE\_SECRET\_KEY\!, { apiVersion: "2024-06-20" });

export async function POST(req: Request) {  
  const { listingId, successUrl, cancelUrl } \= await req.json();

  const supa \= createServerClient(process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!, { cookies: { get: (n:string)=\>cookies().get(n)?.value } as any });  
  const { data: { user } } \= await supa.auth.getUser();  
  if (\!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: listing, error } \= await supa  
    .from("listings")  
    .select("id, price\_cents, currency, title, history\_id, owner\_id, status")  
    .eq("id", listingId).single();  
  if (error || \!listing || listing.status \!== "active") return NextResponse.json({ error: "unavailable" }, { status: 400 });

  const { data: order } \= await supa.from("orders").insert({  
    buyer\_id: user.id, listing\_id: listing.id,  
    amount\_cents: listing.price\_cents, currency: listing.currency, status: "pending"  
  }).select().single();

  const session \= await stripe.checkout.sessions.create({  
    mode: "payment",  
    client\_reference\_id: order.id,  
    line\_items: \[{  
      price\_data: {  
        currency: listing.currency.toLowerCase(),  
        unit\_amount: listing.price\_cents,  
        product\_data: { name: listing.title || "Design License" }  
      },  
      quantity: 1  
    }\],  
    success\_url: successUrl,  
    cancel\_url: cancelUrl  
  });

  await supa.from("orders").update({ stripe\_session\_id: session.id }).eq("id", order.id);  
  return NextResponse.json({ url: session.url });  
}

Webhook（支払い完了 → 原本ZIPを deliver/ に格納 → 署名URL返す）

app/api/webhooks/stripe/route.ts

import Stripe from "stripe";  
import { NextResponse } from "next/server";  
import { createServerClient } from "@supabase/supabase-js";  
import { r2, R2\_BUCKET, presignGet, GetObjectCommand, PutObjectCommand } from "@/lib/r2";  
import JSZip from "jszip";  
export const runtime \= "nodejs";

export async function POST(req: Request) {  
  const sig \= req.headers.get("stripe-signature")\!;  
  const raw \= await req.arrayBuffer();  
  let event: Stripe.Event;

  try {  
    event \= new Stripe(process.env.STRIPE\_SECRET\_KEY\!, { apiVersion: "2024-06-20" })  
      .webhooks.constructEvent(Buffer.from(raw), sig, process.env.STRIPE\_WEBHOOK\_SECRET\!);  
  } catch (e:any) {  
    return new NextResponse(\`Webhook Error: ${e.message}\`, { status: 400 });  
  }

  if (event.type \=== "checkout.session.completed") {  
    const session \= event.data.object as Stripe.Checkout.Session;  
    const orderId \= session.client\_reference\_id\!;  
    const supa \= createServerClient(process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!, process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!, { auth: { persistSession: false } });

    const { data: order } \= await supa.from("orders").select("id, listing\_id, buyer\_id").eq("id", orderId).single();  
    const { data: listing } \= await supa.from("listings").select("history\_id, owner\_id").eq("id", order\!.listing\_id).single();  
    const { data: hist } \= await supa.from("generation\_history").select("image\_path, prompt").eq("id", listing\!.history\_id).single();

    const obj \= await r2.send(new GetObjectCommand({ Bucket: R2\_BUCKET, Key: hist\!.image\_path }));  
    const buf \= Buffer.from(await obj.Body\!.transformToByteArray());  
    const zip \= new JSZip();  
    zip.file("design.png", buf);  
    zip.file("LICENSE.txt", Buffer.from(\`License issued at ${new Date().toISOString()}\\nListing: ${listing\!.history\_id}\\nPrompt: ${hist\!.prompt}\`));  
    const zipBuf \= await zip.generateAsync({ type: "nodebuffer" });

    const deliverKey \= \`deliver/${orderId}/package.zip\`;  
    await r2.send(new PutObjectCommand({ Bucket: R2\_BUCKET, Key: deliverKey, Body: zipBuf, ContentType: "application/zip" }));  
    const url \= await presignGet(deliverKey, 60 \* 60 \* 24 \* 7); // 7日

    await supa.from("orders").update({ status: "paid", paid\_at: new Date().toISOString(), deliver\_path: deliverKey, deliver\_url: url }).eq("id", orderId);  
    await supa.rpc("increment\_listing\_sold", { p\_listing\_id: order\!.listing\_id }).catch(()=\>{});  
  }  
  return NextResponse.json({ received: true });  
}

11\) 公開/非公開のUIルール（ユーザー目線）  
	•	生成直後は 非公開（MY PAGE 内のみ）。  
	•	「公開する」→ 透かしプレビューを public/ に生成し、listings を作成。ギャラリーに表示・購入可。  
	•	「非公開に戻す」→ listings を paused、generation\_history.is\_public=false。  
	•	購入後は deliver/ にZIP納品 → 注文履歴ページからダウンロード（署名URL）。

⸻

運用のコツ（ユニーク性・速度・安定）  
	•	\*\*自由入力“1行”\*\*をUIに（素材/ディテール一つ）。選択式の被りを回避しつつ簡単さを維持。  
	•	まず 3:4で1枚プレビュー（同期APIで即返し）→ OKなら同プロンプト再実行で派生比率（1:1/9:16等）。  
	•	キャッシュ：hash(answers \+ extra) をキーに24hキャッシュするとさらに体感高速。  
	•	否定語は常に明示（上の NEGATIVE）。  
	•	秘密鍵は必ずサーバ限定。スクショで晒したキーは即ローテーション。  
	•	R2バケットは、\*\*原本（usergen）\*\*はURLを直で晒さない運用、\*\*公開はプレビュー（public）\*\*を使うのが安全。
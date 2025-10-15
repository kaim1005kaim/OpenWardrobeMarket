// app/api/r2-presign/route.ts
export const runtime = 'nodejs';
export const revalidate = 0;

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import https from "https";
import dns from "dns";

const s3 = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // R2の定石
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      keepAlive: true,
      // IPv6経路の相性切り分け：IPv4を優先
      lookup: (host, options, cb) => dns.lookup(host, { ...options, family: 4 }, cb),
      minVersion: "TLSv1.2",
    }),
  }),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const contentType = searchParams.get("contentType") ?? "application/octet-stream";
    
    if (!key) {
      return new Response(JSON.stringify({ error: "missing key" }), { status: 400 });
    }

    const cmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5分間有効
    return Response.json({ url });

  } catch (e: any) {
    console.error('Error creating presigned URL:', e);
    return new Response(JSON.stringify({ error: 'Failed to create presigned URL', details: e.message }), { status: 500 });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.R2_BUCKET || "owm-assets";

// R2 S3 Client initialization
const r2 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

/**
 * POST /api/r2-presign
 * body: { key: string, contentType: string }
 * return: { url, bucket, key }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    console.log('R2 Presign API called with:', req.body);
    console.log('Environment check:', {
      bucket: process.env.R2_BUCKET,
      endpoint: process.env.R2_S3_ENDPOINT,
      hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
    });
    
    const { key, contentType } = req.body ?? {};
    if (!key || !contentType) {
      return res.status(400).json({ error: "key and contentType required" });
    }

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,                       // e.g. images/2025/08/28/<uuid>.jpg
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    // 署名URL（5分有効）
    const url = await getSignedUrl(r2, cmd, { expiresIn: 300 });
    return res.status(200).json({ url, bucket: BUCKET, key });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "presign failed" });
  }
}
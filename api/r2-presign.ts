import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../src/lib/r2";

const BUCKET = process.env.R2_BUCKET || "owm-assets";

/**
 * POST /api/r2-presign
 * body: { key: string, contentType: string }
 * return: { url, bucket, key }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  try {
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
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ENDPOINT = process.env.R2_S3_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_ENV = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL_ENV =
  process.env.R2_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || null;

export const R2_BUCKET = R2_BUCKET_ENV ?? null;
export const R2_PUBLIC_BASE_URL = R2_PUBLIC_BASE_URL_ENV ?? null;

export const isR2Configured = Boolean(
  R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_ENV
);

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (!isR2Configured) {
    throw new Error("R2 client is not configured");
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: R2_S3_ENDPOINT!,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!
      },
      forcePathStyle: true
    });
  }

  return cachedClient;
}

export const r2 = isR2Configured ? getR2Client() : null;

export async function presignGet(key: string, secs = 60 * 60) {
  if (!isR2Configured || !R2_BUCKET) {
    throw new Error("R2 client is not configured");
  }

  return await getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: secs }
  );
}

export { GetObjectCommand, PutObjectCommand, CopyObjectCommand, ListObjectsV2Command };

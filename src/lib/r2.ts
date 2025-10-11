import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export const R2_BUCKET = process.env.R2_BUCKET!;
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

export function presignGet(key: string, secs = 60 * 60) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: secs });
}

export { GetObjectCommand, PutObjectCommand, CopyObjectCommand, ListObjectsV2Command };
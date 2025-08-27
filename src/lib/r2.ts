import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_S3_ENDPOINT, // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});
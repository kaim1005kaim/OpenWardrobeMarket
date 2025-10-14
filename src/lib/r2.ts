const R2_S3_API_ENDPOINT = process.env.R2_S3_ENDPOINT;
const R2_CUSTOM_DOMAIN_URL = process.env.R2_CUSTOM_DOMAIN_URL;

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_ENV = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL_ENV =
  R2_CUSTOM_DOMAIN_URL || process.env.R2_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || null;

export const R2_BUCKET = R2_BUCKET_ENV ?? null;
export const R2_PUBLIC_BASE_URL = R2_PUBLIC_BASE_URL_ENV ?? null;

export const isR2Configured = Boolean(
  R2_S3_API_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_ENV
);

function createR2Client(endpoint: string): S3Client {
  if (!isR2Configured) {
    throw new Error("R2 client is not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!
    },
    forcePathStyle: true
  });
}

// Client for API operations
export const r2 = isR2Configured ? createR2Client(R2_S3_API_ENDPOINT!) : null;

// Client specifically for presigning URLs with the custom domain
const r2Presigner = isR2Configured ? createR2Client(R2_CUSTOM_DOMAIN_URL || R2_S3_API_ENDPOINT!) : null;

export async function presignGet(key: string, secs = 60 * 60) {
  if (!r2Presigner || !R2_BUCKET) {
    throw new Error("R2 presigner is not configured");
  }

  return await getSignedUrl(
    r2Presigner,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: secs }
  );
}

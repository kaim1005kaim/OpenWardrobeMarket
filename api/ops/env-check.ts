import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  runtime: 'nodejs'
};
function maskValue(value: string | null): string {
  if (!value) return '(unset)';
  if (value.length <= 8) return `${value.slice(0, 2)}…${value.slice(-2)}`;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const endpointRaw = process.env.R2_S3_ENDPOINT ?? null;
  const accessKeyRaw = process.env.R2_ACCESS_KEY_ID ?? null;
  const secretKeyRaw = process.env.R2_SECRET_ACCESS_KEY ?? null;
  const bucketRaw = process.env.R2_BUCKET ?? null;
  const publicUrlRaw =
    process.env.R2_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? null;

  const isR2Configured =
    Boolean(endpointRaw && accessKeyRaw && secretKeyRaw && bucketRaw) && endpointRaw !== '(unset)';

  const publicUrl = maskValue(publicUrlRaw);
  const endpoint = maskValue(process.env.R2_S3_ENDPOINT ?? null);
  const accessKey = maskValue(accessKeyRaw);
  const secretKey = maskValue(secretKeyRaw);
  const bucket = maskValue(bucketRaw);

  return res.status(200).json({
    R2_PUBLIC_BASE_URL: publicUrl,
    R2_S3_ENDPOINT: endpoint,
    R2_ACCESS_KEY_ID: accessKey,
    R2_SECRET_ACCESS_KEY: secretKey,
    R2_BUCKET: bucket,
    isR2Configured
  });
}

export const runtime = 'nodejs';
export const revalidate = 0;

function maskValue(value: string | null | undefined): string {
  if (!value) return '(unset)';
  if (value.length <= 8) return `${value.slice(0, 2)}…${value.slice(-2)}`;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export async function GET(request: Request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const endpointRaw = process.env.R2_S3_ENDPOINT ?? null;
  const accessKeyRaw = process.env.R2_ACCESS_KEY_ID ?? null;
  const secretKeyRaw = process.env.R2_SECRET_ACCESS_KEY ?? null;
  const bucketRaw = process.env.R2_BUCKET ?? null;
  const publicUrlRaw =
    process.env.R2_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? null;

  const isR2Configured =
    Boolean(endpointRaw && accessKeyRaw && secretKeyRaw && bucketRaw) && endpointRaw !== '(unset)';

  const endpointDetails = (() => {
    if (!endpointRaw) return null;
    try {
      const url = new URL(endpointRaw);
      return { host: url.host, path: url.pathname || '/' };
    } catch {
      return { raw: endpointRaw };
    }
  })();

  const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const supabaseServiceKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const supabaseAnonKeyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

  const isSupabaseConfigured = Boolean(
    supabaseUrlRaw && supabaseServiceKeyRaw && supabaseAnonKeyRaw
  );

  return Response.json({
    R2_PUBLIC_BASE_URL: maskValue(publicUrlRaw),
    R2_S3_ENDPOINT: maskValue(endpointRaw),
    R2_S3_ENDPOINT_details: endpointDetails,
    R2_ACCESS_KEY_ID: maskValue(accessKeyRaw),
    R2_SECRET_ACCESS_KEY: maskValue(secretKeyRaw),
    R2_BUCKET: maskValue(bucketRaw),
    isR2Configured,
    NEXT_PUBLIC_SUPABASE_URL: maskValue(supabaseUrlRaw),
    SUPABASE_SERVICE_ROLE_KEY: maskValue(supabaseServiceKeyRaw),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: maskValue(supabaseAnonKeyRaw),
    isSupabaseConfigured,
    nodeVersion: process.version,
    opensslVersion: process.versions?.openssl ?? null
  });
}

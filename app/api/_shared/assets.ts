import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are not configured');
}

export type AssetStatus = 'public' | 'private' | 'delisted';

export interface SerializedAsset {
  id: string;
  userId: string | null;
  title: string;
  status: AssetStatus;
  tags: string[];
  price: number | null;
  likes: number;
  createdAt: string | null;
  updatedAt: string | null;
  src: string;
  finalUrl: string | null;
  rawUrl: string | null;
  finalKey: string | null;
  rawKey: string | null;
  coverColor?: string | null;
  isLiked?: boolean;
  metadata?: Record<string, any>;
}

export type SerializedAssetOptions = {
  kind: 'raw' | 'final';
  includeRaw?: boolean;
  likedIds?: Set<string>;
};

const R2_S3_API_ENDPOINT = process.env.R2_S3_ENDPOINT || null;
const R2_CUSTOM_DOMAIN_URL = process.env.R2_CUSTOM_DOMAIN_URL || null;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || null;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || null;
const R2_BUCKET_ENV = process.env.R2_BUCKET || null;
const R2_PUBLIC_BASE_URL_ENV =
  R2_CUSTOM_DOMAIN_URL ||
  process.env.R2_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  null;

export const R2_BUCKET = R2_BUCKET_ENV ?? null;
export const R2_PUBLIC_BASE_URL = R2_PUBLIC_BASE_URL_ENV ?? null;

export const isR2Configured = Boolean(
  R2_S3_API_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_ENV
);

function createR2Client(endpoint: string | null): S3Client | null {
  if (!endpoint || !isR2Configured) return null;

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!
    },
    forcePathStyle: true
  });
}

const r2Client = createR2Client(R2_S3_API_ENDPOINT);
const r2PresignClient = createR2Client(R2_S3_API_ENDPOINT);

const ALLOWED_PREFIXES = ['catalog/', 'usergen/', 'generated/'];

function matchesAllowedPrefix(value: string | null | undefined) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return ALLOWED_PREFIXES.some((prefix) => lower.includes(prefix));
}

export function assetIsAllowed(row: Record<string, any>): boolean {
  const keys = [
    row.final_key,
    row.raw_key,
    row.r2_key,
    row.image_key,
    row.poster_key,
    row.raw_path,
    row.raw_r2_key,
    row.final_r2_key
  ]
    .filter(Boolean)
    .map(String);

  const urls = [
    row.final_url,
    row.raw_url,
    row.r2_url,
    row.image_url,
    row.poster_url
  ]
    .filter(Boolean)
    .map(String);

  return keys.some(matchesAllowedPrefix) || urls.some(matchesAllowedPrefix);
}

let cachedAdminClient: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    });
  }
  return cachedAdminClient;
}

export function getSupabaseForToken(token: string | null | undefined): SupabaseClient | null {
  if (!token) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false
    }
  });
}

function extractAuthHeader(req: Request | { headers?: any }): string | null {
  if (req instanceof Request) {
    return req.headers.get('authorization');
  }
  const headers = (req as any)?.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get('authorization');
  }
  return headers.authorization || headers.Authorization || null;
}

export async function getAuthUser(req: Request | { headers?: any }) {
  const authHeader = extractAuthHeader(req);
  if (!authHeader) {
    return { user: null, token: null };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { user: null, token: null };
  }

  const supabase = getSupabaseForToken(token);
  if (!supabase) {
    return { user: null, token: null };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { user: null, token: null };
  }

  return { user: data.user, token };
}

function extractWithFallback<T extends Record<string, any>>(
  row: T,
  keys: string[],
  fallback: any = null
) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return fallback;
}

function normaliseStatus(rawStatus: string | null | undefined, row: any): AssetStatus {
  if (rawStatus === 'delisted') return 'delisted';
  if (rawStatus === 'public') return 'public';
  if (rawStatus === 'private') return 'private';
  if (typeof row.is_public === 'boolean') {
    return row.is_public ? 'public' : 'private';
  }
  return 'private';
}

function ensureHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

function isAbsoluteUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function normaliseBaseUrl(url: string | null): string | null {
  if (!url) return null;
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildR2Url(baseUrl: string | null, key: string | null | undefined): string | null {
  if (!baseUrl || !key) return null;
  const sanitizedKey = key.replace(/^\/+/, '');
  return `${baseUrl}/${sanitizedKey}`;
}

function extractPathFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return value;
  }
}

function normaliseR2Key(value: string | null | undefined): string | null {
  if (!value) return null;
  let key = extractPathFromUrl(String(value)).trim();
  if (!key) return null;
  key = key.replace(/^\/+/, '');

  if (R2_BUCKET) {
    const bucketPrefix = `${R2_BUCKET}/`.toLowerCase();
    if (key.toLowerCase().startsWith(bucketPrefix)) {
      key = key.slice(bucketPrefix.length);
    }
  }

  return key || null;
}

let hasLoggedPresignWarning = false;

async function tryPresign(key: string | null | undefined, expiresIn = 60 * 15): Promise<string | null> {
  const normalisedKey = normaliseR2Key(key);
  if (!normalisedKey) return null;
  if (!isR2Configured) {
    if (!hasLoggedPresignWarning) {
      console.warn('[api/assets] R2 configuration missing; falling back to public URLs when available');
      hasLoggedPresignWarning = true;
    }
    return null;
  }

  try {
    if (!r2PresignClient || !R2_BUCKET) {
      throw new Error('R2 presigner is not configured');
    }
    return await getSignedUrl(
      r2PresignClient,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: normalisedKey }),
      { expiresIn: expiresIn }
    );
  } catch (error: any) {
    if (!hasLoggedPresignWarning) {
      console.warn(
        '[api/assets] Failed to presign R2 object. Falling back to non-signed URL if possible.',
        { key, message: error?.message || error }
      );
      hasLoggedPresignWarning = true;
    }
    return null;
  }
}

export async function serializeAsset(
  row: Record<string, any>,
  options: SerializedAssetOptions
): Promise<SerializedAsset> {
  const status = normaliseStatus(row.status, row);

  const rawKey = extractWithFallback(row, ['raw_key', 'raw_r2_key', 'raw_path', 'raw_object_key']);
  const finalKey = extractWithFallback(row, ['final_key', 'final_r2_key', 'poster_key', 'r2_key', 'image_key']);

  const rawKeyNormalised = normaliseR2Key(rawKey);
  const finalKeyNormalised = normaliseR2Key(finalKey);

  const storedRawUrl = ensureHttps(
    extractWithFallback(row, ['raw_url', 'raw_r2_url', 'raw_signed_url'])
  );
  const storedFinalUrl = ensureHttps(
    extractWithFallback(row, ['final_url', 'final_r2_url', 'poster_url', 'r2_url', 'image_url'])
  );

  const r2BaseUrl = normaliseBaseUrl(R2_PUBLIC_BASE_URL);

  let rawUrl: string | null = storedRawUrl;
  let finalUrl: string | null = storedFinalUrl;

  if (options.kind === 'raw' || options.includeRaw) {
    const rawCandidates = [
      rawKeyNormalised,
      storedRawUrl && !isAbsoluteUrl(storedRawUrl) ? storedRawUrl : null
    ].filter(Boolean) as string[];

    for (const candidate of rawCandidates) {
      const presigned = await tryPresign(candidate);
      if (presigned) {
        rawUrl = presigned;
        break;
      }
    }
  }

  if ((!finalUrl || !isAbsoluteUrl(finalUrl)) && finalKeyNormalised) {
    const presignedFinal = await tryPresign(finalKeyNormalised);
    if (presignedFinal) {
      finalUrl = presignedFinal;
    }
  }

  if ((!finalUrl || !isAbsoluteUrl(finalUrl)) && storedFinalUrl && !isAbsoluteUrl(storedFinalUrl)) {
    const presignedFromStored = await tryPresign(storedFinalUrl);
    if (presignedFromStored) {
      finalUrl = presignedFromStored;
    }
  }

  if (!rawUrl || !isAbsoluteUrl(rawUrl)) {
    const fallbackRawKey =
      rawKeyNormalised || normaliseR2Key(rawUrl && !isAbsoluteUrl(rawUrl) ? rawUrl : null);
    const fallbackRawUrl = buildR2Url(r2BaseUrl, fallbackRawKey);
    if (fallbackRawUrl) {
      rawUrl = fallbackRawUrl;
    } else if (rawUrl) {
      rawUrl = ensureHttps(rawUrl);
    }
  }

  if (!finalUrl || !isAbsoluteUrl(finalUrl)) {
    const fallbackFinalKey =
      finalKeyNormalised || normaliseR2Key(finalUrl && !isAbsoluteUrl(finalUrl) ? finalUrl : null);
    const fallbackFinalUrl = buildR2Url(r2BaseUrl, fallbackFinalKey);
    if (fallbackFinalUrl) {
      finalUrl = fallbackFinalUrl;
    } else if (finalUrl) {
      finalUrl = ensureHttps(finalUrl);
    }
  }

  const src =
    (options.kind === 'raw' ? rawUrl : finalUrl) ||
    rawUrl ||
    finalUrl ||
    'https://via.placeholder.com/640x960/EEECE6/999?text=Design';

  if (R2_CUSTOM_DOMAIN_URL) {
    const customBase = normaliseBaseUrl(R2_CUSTOM_DOMAIN_URL);
    if (customBase) {
      if (finalKeyNormalised) {
        finalUrl = buildR2Url(customBase, finalKeyNormalised) ?? finalUrl;
      }
      if (rawKeyNormalised) {
        rawUrl = buildR2Url(customBase, rawKeyNormalised) ?? rawUrl;
      }
    }
  }

  const likedIds = options.likedIds;
  const price = extractWithFallback(row, ['price', 'listing_price', 'buyout_price'], null);

  return {
    id: row.id,
    userId: row.user_id || null,
    title: row.title || row.prompt || 'Generated Design',
    status,
    tags: row.tags || [],
    price: typeof price === 'number' ? price : price ? Number(price) : null,
    likes: extractWithFallback(row, ['likes_count', 'likes'], 0) || 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    src,
    finalUrl,
    rawUrl: rawUrl ?? null,
    finalKey: finalKeyNormalised ?? finalKey ?? null,
    rawKey: rawKeyNormalised ?? rawKey ?? null,
    coverColor: extractWithFallback(row, ['dominant_color', 'cover_color'], null),
    isLiked: likedIds ? likedIds.has(row.id) : undefined,
    metadata: row.metadata || row.generation_data || null
  };
}

import type { NextApiRequest } from 'next';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { presignGet, R2_PUBLIC_BASE_URL } from '../../src/lib/r2';

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

export async function getAuthUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
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

function extractWithFallback<T extends Record<string, any>>(row: T, keys: string[], fallback: any = null) {
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

export async function serializeAsset(
  row: Record<string, any>,
  options: SerializedAssetOptions
): Promise<SerializedAsset> {
  const status = normaliseStatus(row.status, row);

  const rawKey = extractWithFallback(row, ['raw_key', 'raw_r2_key', 'raw_path', 'raw_object_key']);
  const finalKey = extractWithFallback(row, ['final_key', 'final_r2_key', 'poster_key', 'r2_key', 'image_key']);

  const storedRawUrl = ensureHttps(
    extractWithFallback(row, ['raw_url', 'raw_r2_url', 'raw_signed_url'])
  );
  const storedFinalUrl = ensureHttps(
    extractWithFallback(row, ['final_url', 'final_r2_url', 'poster_url', 'r2_url', 'image_url'])
  );

  let rawUrl: string | null = storedRawUrl;
  let finalUrl: string | null = storedFinalUrl;

  if (!finalUrl && finalKey) {
    finalUrl = `${R2_PUBLIC_BASE_URL}/${finalKey}`;
  }

  if (options.kind === 'raw' || options.includeRaw) {
    if (rawKey) {
      rawUrl = await presignGet(rawKey, 60 * 15);
    } else if (storedRawUrl && !storedRawUrl.startsWith('http')) {
      rawUrl = await presignGet(storedRawUrl, 60 * 15);
    }
  }

  if (!finalUrl && finalKey) {
    finalUrl = await presignGet(finalKey, 60 * 15);
  } else if (options.kind === 'final' && finalKey && finalUrl && finalUrl.includes('/r2.dev/')) {
    // Already a public URL
  }

  const src =
    (options.kind === 'raw' ? rawUrl : finalUrl) ||
    rawUrl ||
    finalUrl ||
    'https://via.placeholder.com/640x960/EEECE6/999?text=Design';

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
    finalKey: finalKey ?? null,
    rawKey: rawKey ?? null,
    coverColor: extractWithFallback(row, ['dominant_color', 'cover_color'], null),
    isLiked: likedIds ? likedIds.has(row.id) : undefined,
    metadata: row.metadata || row.generation_data || null,
  };
}

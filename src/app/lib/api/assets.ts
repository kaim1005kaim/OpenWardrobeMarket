import { supabase } from '../supabase';
import type { Asset, AssetStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

async function buildAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // ignore session errors
  }

  return headers;
}

export interface FetchAssetsParams {
  scope?: 'public' | 'mine' | 'liked';
  kind?: 'raw' | 'final';
  limit?: number;
  cursor?: string | null;
}

export interface FetchAssetsResponse {
  assets: Asset[];
  cursor: string | null;
}

export async function fetchAssets(params: FetchAssetsParams = {}): Promise<FetchAssetsResponse> {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.kind) query.set('kind', params.kind);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);

  const url = `${API_BASE}/api/assets${query.toString() ? `?${query.toString()}` : ''}`;
  const headers = await buildAuthHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch assets: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    assets: (data.assets || []) as Asset[],
    cursor: data.cursor ?? null
  };
}

export async function updateAssetStatus(assetId: string, status: AssetStatus): Promise<Asset> {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE}/api/assets/${assetId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update asset status: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.asset as Asset;
}

export async function deleteAsset(assetId: string): Promise<void> {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE}/api/assets/${assetId}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete asset: ${response.status} ${errorText}`);
  }
}

export async function toggleLike(assetId: string, shouldLike: boolean): Promise<void> {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE}/api/likes/${assetId}`, {
    method: shouldLike ? 'POST' : 'DELETE',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to ${shouldLike ? 'like' : 'unlike'} asset: ${response.status} ${errorText}`);
  }
}

export async function fetchLikedAssets(): Promise<Asset[]> {
  const headers = await buildAuthHeaders();

  const response = await fetch(`${API_BASE}/api/likes`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to load liked assets: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (data.assets || []) as Asset[];
}

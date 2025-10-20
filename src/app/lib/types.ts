export type AssetStatus = 'public' | 'private' | 'delisted';

export type Asset = {
  id: string;
  userId?: string | null;
  src: string;
  finalUrl?: string | null;
  rawUrl?: string | null;
  finalKey?: string | null;
  rawKey?: string | null;
  w?: number;
  h?: number;
  title: string;
  tags: string[];
  colors?: string[];
  price?: number | null;
  creator?: string;
  likes?: number;
  liked?: boolean;
  isLiked?: boolean;
  isAd?: boolean;
  type?: 'catalog' | 'user' | 'generated';
  createdAt?: string;
  updatedAt?: string | null;
  status?: AssetStatus;
  isPublic?: boolean;
  is_published?: boolean; // legacy compatibility
  prompt?: string;
  aspect_ratio?: string;
  blur_data_url?: string;
  dominant_color?: string;
  variation?: string;
  metadata?: Record<string, any> | null;
  generationData?: any;
};

export type GenParams = {
  silhouette?: string;
  palette?: string;
  vibe?: string;
  season?: string;
  fabric?: string;
  priceBand?: string;
  notes?: string;
  signature?: string;
  axisCleanBold?: number;
  axisClassicFuture?: number;
  axisSoftSharp?: number;
};

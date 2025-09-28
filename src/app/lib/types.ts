export type Asset = {
  id: string;
  src: string;
  w?: number;
  h?: number;
  title: string;
  tags: string[];
  colors?: string[];
  price?: number;
  creator?: string;
  likes?: number;
  liked?: boolean;
  isAd?: boolean;
  type?: 'catalog' | 'user' | 'generated';
  createdAt?: string;
  isPublic?: boolean;
  is_published?: boolean; // Added for UserGallery component
  prompt?: string;
  aspect_ratio?: string;
  blur_data_url?: string;
  dominant_color?: string;
  variation?: string;
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
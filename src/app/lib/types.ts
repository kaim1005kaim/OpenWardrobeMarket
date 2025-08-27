export type Asset = {
  id: string;
  src: string;
  w: number;
  h: number;
  title: string;
  tags: string[];
  colors: string[];
  price?: number;
  creator?: string;
  likes: number;
  isAd?: boolean;
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
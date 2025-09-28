import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const BUCKET = process.env.R2_BUCKET || "owm-assets";
const PUBLIC_URL = "https://pub-4215f2149d4e4f369c2bde9f2769dfd4.r2.dev";

// R2 S3 Client initialization
const r2 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

/**
 * GET /api/catalog
 * return: { images: Array<{id, src, title, tags}> }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  
  try {
    console.log('Fetching catalog images from R2...');
    
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'catalog/',
      MaxKeys: 1000, // 最初の1000個を取得
    });

    const response = await r2.send(listCommand);
    const objects = response.Contents || [];
    
    // 画像ファイルのみをフィルタリングし、Asset形式に変換（macOSの._ファイルを除く）
    const images = objects
      .filter(obj => {
        const key = obj.Key || '';
        return key.match(/\.(png|jpg|jpeg|webp)$/i) && 
               key !== 'catalog/' && 
               !key.includes('/._');
      })
      .map(obj => {
        const key = obj.Key!;
        const filename = key.replace('catalog/', '');
        
        // ファイル名から情報を抽出
        const cleanTitle = filename
          .replace(/\.(png|jpg|jpeg|webp)$/i, '')
          .replace(/_/g, ' ')
          .replace(/\([0-9]+\)/g, '') // (1), (2) などの番号を削除
          .trim();
        
        // スタイル情報をタグとして抽出
        const tags = extractTagsFromFilename(cleanTitle);
        
        return {
          id: key.replace(/[^a-zA-Z0-9]/g, '_'), // ユニークID生成
          src: `${PUBLIC_URL}/${key}`,
          title: cleanTitle.length > 60 ? cleanTitle.substring(0, 60) + '...' : cleanTitle,
          tags,
          type: 'catalog' as const,
          liked: false,
          createdAt: obj.LastModified?.toISOString() || new Date().toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // 新しい順

    console.log(`Found ${images.length} catalog images`);
    
    return res.status(200).json({ 
      images,
      total: images.length,
      source: 'r2-catalog'
    });
    
  } catch (e: any) {
    console.error('Catalog API error:', e);
    return res.status(500).json({ 
      error: e?.message || "Failed to fetch catalog",
      images: [],
      total: 0 
    });
  }
}

function extractTagsFromFilename(filename: string): string[] {
  const tags: string[] = [];
  
  // 年代を抽出
  const yearMatch = filename.match(/(\d{4}s)/);
  if (yearMatch) tags.push(yearMatch[1]);
  
  // ブランド名を抽出
  const brandPatterns = [
    /Balenciaga/i, /Chanel/i, /Dior/i, /Prada/i, /Gucci/i,
    /Calvin Klein/i, /Giorgio Armani/i, /Yves Saint Laurent/i,
    /Valentino/i, /Versace/i, /Issey Miyake/i, /Comme des Garcons/i
  ];
  
  for (const pattern of brandPatterns) {
    if (pattern.test(filename)) {
      const match = filename.match(pattern);
      if (match) tags.push(match[0]);
      break;
    }
  }
  
  // スタイル要素を抽出
  const styleKeywords = [
    'full-body', 'portrait', 'minimalist', 'avant-garde', 
    'casual', 'elegant', 'street', 'formal', 'vintage',
    'modern', 'classic', 'luxury', 'bohemian'
  ];
  
  for (const keyword of styleKeywords) {
    if (filename.toLowerCase().includes(keyword.toLowerCase())) {
      tags.push(keyword);
    }
  }
  
  return [...new Set(tags)]; // 重複除去
}
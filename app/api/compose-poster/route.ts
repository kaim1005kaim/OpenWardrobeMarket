export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage, Image } from 'canvas';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2クライアント設定
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// ポスターテンプレート定義
interface PosterTemplate {
  id: string;
  framePath: string;
  backgroundColor: string;
  frameSize: { width: number; height: number };
  imageArea: { x: number; y: number; width: number; height: number };
}

const posterTemplates: PosterTemplate[] = [
  {
    id: 'poster-a',
    framePath: './public/poster/BG/poster_BG/a.png',
    backgroundColor: '#5B7DB1',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-b',
    framePath: './public/poster/BG/poster_BG/b.png',
    backgroundColor: '#E8B4B8',
    frameSize: { width: 800, height: 983 },
    imageArea: { x: 0, y: 100, width: 515, height: 883 },
  },
  {
    id: 'poster-c',
    framePath: './public/poster/BG/poster_BG/c.png',
    backgroundColor: '#E8B4B8',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 145, y: 175, width: 520, height: 650 },
  },
  {
    id: 'poster-d',
    framePath: './public/poster/BG/poster_BG/d.png',
    backgroundColor: '#FF8C42',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 250, y: 305, width: 355, height: 445 },
  },
  {
    id: 'poster-e',
    framePath: './public/poster/BG/poster_BG/e.png',
    backgroundColor: '#F4E4C1',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-f',
    framePath: './public/poster/BG/poster_BG/f.png',
    backgroundColor: '#D4A5A5',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-g',
    framePath: './public/poster/BG/poster_BG/g.png',
    backgroundColor: '#9AC1F0',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-h',
    framePath: './public/poster/BG/poster_BG/h.png',
    backgroundColor: '#C8E3D4',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-i',
    framePath: './public/poster/BG/poster_BG/i.png',
    backgroundColor: '#FFD6A5',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
  {
    id: 'poster-j',
    framePath: './public/poster/BG/poster_BG/j.png',
    backgroundColor: '#E5C1CD',
    frameSize: { width: 800, height: 1000 },
    imageArea: { x: 100, y: 125, width: 600, height: 750 },
  },
];

// ランダムなテンプレートを選択
function getRandomTemplate(): PosterTemplate {
  const randomIndex = Math.floor(Math.random() * posterTemplates.length);
  console.log(`[compose-poster] Selected random template ${randomIndex}: ${posterTemplates[randomIndex].id}`);
  return posterTemplates[randomIndex];
}

// ポスター合成処理
async function composePoster(imageUrl: string): Promise<Buffer> {
  const template = getRandomTemplate();

  console.log(`[compose-poster] Using template: ${template.id}`);
  console.log(`[compose-poster] Frame path: ${template.framePath}`);

  // キャンバス作成
  const canvas = createCanvas(template.frameSize.width, template.frameSize.height);
  const ctx = canvas.getContext('2d');

  // 背景色を塗る
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, template.frameSize.width, template.frameSize.height);

  // ユーザー画像を読み込み
  const userImage = await loadImage(imageUrl);

  // ユーザー画像をimageAreaに配置（object-fit: cover風に）
  const area = template.imageArea;
  const imgAspect = userImage.width / userImage.height;
  const areaAspect = area.width / area.height;

  let sx = 0, sy = 0, sWidth = userImage.width, sHeight = userImage.height;

  if (imgAspect > areaAspect) {
    // 画像が横長 → 高さを合わせて、幅をクロップ
    sWidth = userImage.height * areaAspect;
    sx = (userImage.width - sWidth) / 2;
  } else {
    // 画像が縦長 → 幅を合わせて、高さをクロップ
    sHeight = userImage.width / areaAspect;
    sy = (userImage.height - sHeight) / 2;
  }

  ctx.drawImage(
    userImage as unknown as Image,
    sx, sy, sWidth, sHeight,
    area.x, area.y, area.width, area.height
  );

  // フレーム画像を上に重ねる
  try {
    const frameImage = await loadImage(template.framePath);
    ctx.drawImage(frameImage as unknown as Image, 0, 0, template.frameSize.width, template.frameSize.height);
    console.log(`[compose-poster] Frame overlay applied successfully`);
  } catch (err) {
    console.warn(`[compose-poster] Frame image not found: ${template.framePath}, skipping frame overlay`);
  }

  return canvas.toBuffer('image/png');
}

// R2にアップロード
async function uploadToR2(buffer: Buffer, filename: string): Promise<string> {
  const key = `posters/${filename}`;
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  });

  await r2Client.send(command);

  // R2の公開URLを返す
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || 'https://pub-4215f2149d4e4f369c2bde9f2769dfd4.r2.dev';
  const publicUrl = `${publicBaseUrl}/${key}`;

  console.log(`[compose-poster] Uploaded to R2: ${publicUrl}`);

  return publicUrl;
}

// POST /api/compose-poster
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    console.log(`[compose-poster] Composing poster for image: ${imageUrl}`);

    // ポスター合成
    const composedBuffer = await composePoster(imageUrl);

    // R2にアップロード
    const filename = `poster-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const posterUrl = await uploadToR2(composedBuffer, filename);

    console.log(`[compose-poster] Poster created successfully: ${posterUrl}`);

    return NextResponse.json({
      success: true,
      posterUrl,
      originalUrl: imageUrl,
    });
  } catch (error) {
    console.error('[compose-poster] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compose poster',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

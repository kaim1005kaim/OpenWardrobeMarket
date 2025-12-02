/**
 * Quadtych Image Splitter (FUSION v4.0)
 *
 * Splits a single 21:9 ultra-wide horizontal image into 4 vertical panels:
 * - Panel 1 (MAIN): Far left - Hero shot with dynamic pose and editorial background
 * - Panel 2 (FRONT): Middle left - Technical front view on white background
 * - Panel 3 (SIDE): Middle right - 90° profile view on white background
 * - Panel 4 (BACK): Far right - Rear view on white background
 *
 * Input: Base64-encoded 21:9 (2.33:1) image
 * Output: 4 separate images in 9:16 vertical aspect ratio (perfect for mobile)
 */

import sharp from 'sharp';

export interface QuadtychPanel {
  view: 'main' | 'front' | 'side' | 'back';
  buffer: Buffer;
  width: number;
  height: number;
}

export interface QuadtychResult {
  main: QuadtychPanel;
  front: QuadtychPanel;
  side: QuadtychPanel;
  back: QuadtychPanel;
}

/**
 * Split a 21:9 ultra-wide image into 4 equal vertical panels
 * Each panel will be approximately 5.25:9 → resized to 9:16 (mobile-friendly)
 *
 * @param base64Image - Base64-encoded image data (with or without data URL prefix)
 * @param targetHeight - Target height for output images (default: 1600px)
 * @returns Object with 4 panel buffers
 */
export async function splitQuadtych(
  base64Image: string,
  targetHeight: number = 1600
): Promise<QuadtychResult> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Image.includes(',')
      ? base64Image.split(',')[1]
      : base64Image;

    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    console.log('[quadtych-splitter] Original image:', {
      width: originalWidth,
      height: originalHeight,
      aspectRatio: (originalWidth / originalHeight).toFixed(2),
      expectedRatio: '2.33 (21:9)'
    });

    // PANEL EXTRACTION STRATEGY (v6.1 - Black Separator Detection)
    //
    // REALITY CHECK: Gemini 3 Pro doesn't reliably generate equal-width panels.
    // MAINが広く生成される（30-40%）、セパレーターが太い（8-15px）など変動が大きい。
    //
    // NEW STRATEGY: 太い黒セパレーターを確実に検出し、そこで切る
    // 1. Rawピクセルデータから縦線の輝度を計算
    // 2. 最も暗い（黒い）X座標を3箇所見つける
    // 3. セパレーター幅（10px）を考慮してギャップを空ける
    // 4. 可変アスペクト比として返す（フロントで動的表示）

    const rawImage = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: rawBuffer, info } = rawImage;
    const channels = info.channels;

    // 指定されたX座標の「黒さスコア」を計算（高いほど黒い）
    const getBlackLineScore = (x: number): number => {
      let rSum = 0, gSum = 0, bSum = 0;
      const samples = 30; // 縦に30箇所サンプリング

      for (let i = 0; i < samples; i++) {
        const y = Math.floor((originalHeight / samples) * i);
        const idx = (y * info.width + x) * channels;
        rSum += rawBuffer[idx];
        gSum += rawBuffer[idx + 1];
        bSum += rawBuffer[idx + 2];
      }

      const avgBrightness = (rSum + gSum + bSum) / (3 * samples);
      // 黒ければ黒いほどスコアが高い（255 - 輝度）
      return 255 - avgBrightness;
    };

    // 指定範囲内で最も黒いX座標を探す
    const findSeparator = (startRatio: number, endRatio: number, name: string): number => {
      const startX = Math.floor(originalWidth * startRatio);
      const endX = Math.floor(originalWidth * endRatio);
      let bestX = -1;
      let maxScore = 0;

      for (let x = startX; x < endX; x++) {
        const score = getBlackLineScore(x);
        // スコア180以上（かなり黒い）かつ最大値を更新したら記録
        if (score > 180 && score > maxScore) {
          maxScore = score;
          bestX = x;
        }
      }

      console.log(`[quadtych-splitter] ${name} separator: x=${bestX} (${((bestX/originalWidth)*100).toFixed(1)}%), score=${Math.round(maxScore)}`);
      return bestX;
    };

    // 3つのセパレーターを検出
    let sep1 = findSeparator(0.20, 0.45, 'MAIN→FRONT');   // 予想: 25-40%
    let sep2 = findSeparator(0.45, 0.65, 'FRONT→SIDE');   // 予想: 50-60%
    let sep3 = findSeparator(0.65, 0.85, 'SIDE→BACK');    // 予想: 70-80%

    // フォールバック: 黒線が見つからなかったら均等割り
    if (sep1 === -1) {
      sep1 = Math.floor(originalWidth * 0.30);
      console.warn('[quadtych-splitter] ⚠️ MAIN→FRONT separator not found, using 30% fallback');
    }
    if (sep2 === -1) {
      sep2 = Math.floor(originalWidth * 0.55);
      console.warn('[quadtych-splitter] ⚠️ FRONT→SIDE separator not found, using 55% fallback');
    }
    if (sep3 === -1) {
      sep3 = Math.floor(originalWidth * 0.80);
      console.warn('[quadtych-splitter] ⚠️ SIDE→BACK separator not found, using 80% fallback');
    }

    // セパレーターの太さ分（左右5pxずつ = 10px）をギャップとして空ける
    const GAP = 10;

    console.log('[quadtych-splitter] Black separator detection complete:', {
      totalWidth: originalWidth,
      totalHeight: originalHeight,
      separators: {
        sep1: `${sep1}px (${((sep1/originalWidth)*100).toFixed(1)}%)`,
        sep2: `${sep2}px (${((sep2/originalWidth)*100).toFixed(1)}%)`,
        sep3: `${sep3}px (${((sep3/originalWidth)*100).toFixed(1)}%)`
      },
      panelWidths: {
        main: sep1 - GAP,
        front: (sep2 - GAP) - (sep1 + GAP),
        side: (sep3 - GAP) - (sep2 + GAP),
        back: originalWidth - (sep3 + GAP)
      }
    });

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    // Calculate panel dimensions (variable width, fixed height)
    const mainWidth = sep1 - GAP;
    const frontWidth = (sep2 - GAP) - (sep1 + GAP);
    const sideWidth = (sep3 - GAP) - (sep2 + GAP);
    const backWidth = originalWidth - (sep3 + GAP);

    // Extract 4 panels using detected separator positions (v6.1)
    const [mainBuffer, frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // PANEL 1: MAIN (Campaign hero shot)
      // Variable width, preserve aspect ratio
      sharp(imageBuffer)
        .extract({
          left: 0,
          top: 0,
          width: mainWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover',  // フロント側で aspectRatio 表示するため、ここはcoverで統一
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 2: FRONT (Technical front view)
      // Variable width, preserve aspect ratio
      sharp(imageBuffer)
        .extract({
          left: sep1 + GAP,
          top: 0,
          width: frontWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 3: SIDE (Technical side profile)
      // Variable width, preserve aspect ratio
      sharp(imageBuffer)
        .extract({
          left: sep2 + GAP,
          top: 0,
          width: sideWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 4: BACK (Technical rear view)
      // Variable width, preserve aspect ratio
      sharp(imageBuffer)
        .extract({
          left: sep3 + GAP,
          top: 0,
          width: backWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer()
    ]);

    console.log('[quadtych-splitter] Successfully split into 4 panels:', {
      mainSize: mainBuffer.length,
      frontSize: frontBuffer.length,
      sideSize: sideBuffer.length,
      backSize: backBuffer.length
    });

    return {
      main: {
        view: 'main',
        buffer: mainBuffer,
        width: targetWidth,
        height: targetHeight
      },
      front: {
        view: 'front',
        buffer: frontBuffer,
        width: targetWidth,
        height: targetHeight
      },
      side: {
        view: 'side',
        buffer: sideBuffer,
        width: targetWidth,
        height: targetHeight
      },
      back: {
        view: 'back',
        buffer: backBuffer,
        width: targetWidth,
        height: targetHeight
      }
    };
  } catch (error) {
    console.error('[quadtych-splitter] Error splitting image:', error);
    throw new Error(`Failed to split quadtych: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert a Buffer to base64 string (for storage/transmission)
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Helper to create data URL from buffer
 */
export function bufferToDataURL(buffer: Buffer, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${bufferToBase64(buffer)}`;
}

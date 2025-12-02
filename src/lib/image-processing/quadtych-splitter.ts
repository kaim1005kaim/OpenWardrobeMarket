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

    // PANEL EXTRACTION STRATEGY (v6.9 - Uniform Trim)
    //
    // ROLLBACK: v6.0-6.1のブラックセパレーター検出は不安定だった
    // - 頭や足が切れてしまう
    // - 黒線が残る
    //
    // ROLLBACK: v6.7-6.8の非対称トリムも位置ずれを引き起こした
    // - MAIN 5% vs SPEC 10%の差異がパネル境界のずれを生む
    // - FRONTにMAINのコンテンツが混入
    //
    // NEW STRATEGY (v6.9): 全パネル統一トリムに戻す
    // - 21:9を4等分 (各パネル 5.25:9)
    // - セパレーター位置は固定（25%, 50%, 75%）
    // - 全パネル8%統一トリミング（セパレーター＋余白除去）
    // - fit: 'contain'で全身が必ず表示される

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    // Simple 4-way division with UNIFORM trim for all panels
    const basePanelWidth = Math.floor(originalWidth / 4);

    // UNIFORM trim: 8% on BOTH sides for ALL panels
    const TRIM_RATIO = 0.08;
    const trimPixels = Math.floor(basePanelWidth * TRIM_RATIO);

    console.log('[quadtych-splitter] Uniform equal division (v6.9):', {
      totalWidth: originalWidth,
      totalHeight: originalHeight,
      basePanelWidth,
      trimPixels,
      panelWidth: basePanelWidth - (trimPixels * 2)
    });

    // Calculate panel dimensions (all identical)
    const panelWidth = basePanelWidth - (trimPixels * 2); // Trim both sides (8% each) for ALL panels

    // Extract 4 panels using simple equal division (v6.9 - Uniform Trim)
    // CRITICAL: All panels use IDENTICAL trim for perfect alignment
    const [mainBuffer, frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // PANEL 1: MAIN (Hero shot) - starts at 0
      sharp(imageBuffer)
        .extract({
          left: 0 + trimPixels,
          top: 0,
          width: panelWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',  // 全身が確実に表示される（letterbox許容）
          background: { r: 245, g: 245, b: 245 } // 薄いグレー背景
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 2: FRONT (Technical front view) - starts at basePanelWidth
      sharp(imageBuffer)
        .extract({
          left: (basePanelWidth * 1) + trimPixels,
          top: 0,
          width: panelWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: { r: 245, g: 245, b: 245 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 3: SIDE (Technical side profile) - starts at basePanelWidth * 2
      sharp(imageBuffer)
        .extract({
          left: (basePanelWidth * 2) + trimPixels,
          top: 0,
          width: panelWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: { r: 245, g: 245, b: 245 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 4: BACK (Technical rear view) - starts at basePanelWidth * 3
      sharp(imageBuffer)
        .extract({
          left: (basePanelWidth * 3) + trimPixels,
          top: 0,
          width: panelWidth,
          height: panelHeight
        })
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: { r: 245, g: 245, b: 245 }
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

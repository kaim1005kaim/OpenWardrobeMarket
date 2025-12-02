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

    // PANEL EXTRACTION STRATEGY (v6.0 - Mathematical 4-Way Division)
    //
    // NEW APPROACH: Since we now force equal-width panels in the generation prompt,
    // we can use simple mathematical division instead of complex AI detection.
    //
    // Calculation: 21:9 ÷ 4 = 5.25:9 ≈ 9:16 (perfect for mobile!)
    //
    // Strategy:
    // 1. Divide image width by 4 to get base panel width
    // 2. Apply 5% safety trim on left/right edges of each panel to remove thick black separators
    // 3. No AI detection needed - pure mathematics!

    const basePanelWidth = Math.floor(originalWidth / 4);

    // Safety trim: Remove 5% from each side to eliminate black separator bars
    // This ensures even if separators are slightly thick or misaligned, they won't appear in final images
    const TRIM_RATIO = 0.05;
    const trimPixels = Math.floor(basePanelWidth * TRIM_RATIO);
    const cropWidth = basePanelWidth - (trimPixels * 2);

    console.log('[quadtych-splitter] Mathematical 4-way division (v6.0):', {
      totalWidth: originalWidth,
      totalHeight: originalHeight,
      basePanelWidth,
      trimPixels,
      cropWidth,
      finalAspectRatio: `${(cropWidth / originalHeight).toFixed(2)}:1 (target: ${(9/16).toFixed(2)}:1 = 9:16)`
    });

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    // Extract 4 panels using mathematical offsets (v6.0)
    const [mainBuffer, frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // PANEL 1: MAIN (Campaign hero shot)
      // Position: 0 to basePanelWidth, with 5% trim on each side
      sharp(imageBuffer)
        .extract({
          left: trimPixels,
          top: 0,
          width: cropWidth,
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

      // PANEL 2: FRONT (Technical front view)
      // Position: basePanelWidth to basePanelWidth*2, with 5% trim on each side
      sharp(imageBuffer)
        .extract({
          left: basePanelWidth + trimPixels,
          top: 0,
          width: cropWidth,
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
      // Position: basePanelWidth*2 to basePanelWidth*3, with 5% trim on each side
      sharp(imageBuffer)
        .extract({
          left: (basePanelWidth * 2) + trimPixels,
          top: 0,
          width: cropWidth,
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
      // Position: basePanelWidth*3 to originalWidth, with 5% trim on each side
      sharp(imageBuffer)
        .extract({
          left: (basePanelWidth * 3) + trimPixels,
          top: 0,
          width: cropWidth,
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

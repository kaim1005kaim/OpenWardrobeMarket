/**
 * Triptych Image Splitter (FUSION v2.0)
 *
 * Splits a single 16:9 horizontal image into 3 vertical panels:
 * - Panel 1 (Front): Left 1/3
 * - Panel 2 (Side): Middle 1/3
 * - Panel 3 (Back): Right 1/3
 *
 * Input: Base64-encoded 16:9 image
 * Output: 3 separate images in 3:4 vertical aspect ratio
 */

import sharp from 'sharp';

export interface TriptychPanel {
  view: 'front' | 'side' | 'back';
  buffer: Buffer;
  width: number;
  height: number;
}

export interface TriptychResult {
  front: TriptychPanel;
  side: TriptychPanel;
  back: TriptychPanel;
}

/**
 * Split a 16:9 image into 3 equal vertical panels (3:4 each)
 *
 * @param base64Image - Base64-encoded image data (with or without data URL prefix)
 * @param targetHeight - Target height for output images (default: 1365px for 3:4 at 1024px width)
 * @returns Object with 3 panel buffers
 */
export async function splitTriptych(
  base64Image: string,
  targetHeight: number = 1365
): Promise<TriptychResult> {
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

    console.log('[triptych-splitter] Original image:', {
      width: originalWidth,
      height: originalHeight,
      aspectRatio: (originalWidth / originalHeight).toFixed(2)
    });

    // v3.5: Calculate panel dimensions with trim ratio to remove white borders
    // For 16:9 input (e.g., 1920x1080), each panel will be 640x1080 (which is ~3:5)
    // We'll then resize to 3:4 (1024x1365)

    // 1. Base panel width (1/3 of total width)
    const basePanelWidth = Math.floor(originalWidth / 3);
    const panelHeight = originalHeight;

    // 2. Trim setting: Remove white borders by cropping from left and right
    // 0.05 (5%) means we remove 5% from left + 5% from right = 10% total, keeping center 90%
    // Increase to 0.08 if white lines are still visible
    const TRIM_RATIO = 0.05;
    const trimPixels = Math.floor(basePanelWidth * TRIM_RATIO);

    // 3. Actual crop width after trimming
    const cropWidth = basePanelWidth - (trimPixels * 2);

    // Calculate target width to maintain 3:4 aspect ratio
    const targetWidth = Math.floor(targetHeight * 3 / 4);

    console.log('[triptych-splitter] Panel dimensions:', {
      originalWidth,
      originalHeight,
      basePanelWidth,
      trimPixels,
      cropWidth,
      targetWidth,
      targetHeight,
      trimRatio: `${TRIM_RATIO * 100}%`
    });

    // Extract and resize each panel with trim applied
    // Use 'inside' fit to preserve the entire image without cropping heads
    const [frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // Front panel (left 1/3): Start from left edge + trimPixels
      sharp(imageBuffer)
        .extract({
          left: 0 + trimPixels,
          top: 0,
          width: cropWidth,
          height: panelHeight
        })
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // Side panel (middle 1/3): Start from center section + trimPixels
      sharp(imageBuffer)
        .extract({
          left: basePanelWidth + trimPixels,
          top: 0,
          width: cropWidth,
          height: panelHeight
        })
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // Back panel (right 1/3): Start from right section + trimPixels
      sharp(imageBuffer)
        .extract({
          left: (basePanelWidth * 2) + trimPixels,
          top: 0,
          width: cropWidth,
          height: panelHeight
        })
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 95 })
        .toBuffer()
    ]);

    console.log('[triptych-splitter] Successfully split into 3 panels:', {
      frontSize: frontBuffer.length,
      sideSize: sideBuffer.length,
      backSize: backBuffer.length
    });

    return {
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
    console.error('[triptych-splitter] Error splitting image:', error);
    throw new Error(`Failed to split triptych: ${error instanceof Error ? error.message : String(error)}`);
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

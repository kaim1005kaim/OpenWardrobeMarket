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

    // Gemini generates 21:9 images with white line separators between panels
    // For 1584x672, the separators are at approximately: 437px, 811px, 1189px (4px wide each)
    // Panel widths: MAIN=437px, FRONT=370px, SIDE=374px, BACK=391px (unequal!)

    // Calculate approximate separator positions based on observed pattern
    // MAIN panel is ~27.6% of width, other panels are ~23.4%, 23.6%, 24.7%
    const separator1 = Math.round(originalWidth * 0.276);  // ~437px for 1584px
    const separator2 = Math.round(originalWidth * 0.512);  // ~811px
    const separator3 = Math.round(originalWidth * 0.750);  // ~1189px
    const separatorWidth = 4; // White line width

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    console.log('[quadtych-splitter] Panel extraction coordinates:', {
      originalWidth,
      originalHeight,
      separator1,
      separator2,
      separator3,
      separatorWidth,
      mainWidth: separator1,
      frontWidth: separator2 - separator1 - separatorWidth,
      sideWidth: separator3 - separator2 - separatorWidth,
      backWidth: originalWidth - separator3 - separatorWidth,
      targetWidth,
      targetHeight,
      outputAspectRatio: '9:16'
    });

    // Extract 4 panels with precise separator boundaries
    const getExtractRegion = (panelIndex: number) => {
      let left: number, width: number;

      switch (panelIndex) {
        case 0: // MAIN
          left = 0;
          width = separator1;
          break;
        case 1: // FRONT
          left = separator1 + separatorWidth;
          width = separator2 - separator1 - separatorWidth;
          break;
        case 2: // SIDE
          left = separator2 + separatorWidth;
          width = separator3 - separator2 - separatorWidth;
          break;
        case 3: // BACK
          left = separator3 + separatorWidth;
          width = originalWidth - separator3 - separatorWidth;
          break;
        default:
          throw new Error(`Invalid panel index: ${panelIndex}`);
      }

      return {
        left,
        top: 0,
        width,
        height: panelHeight
      };
    };

    const [mainBuffer, frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // PANEL 1: MAIN (Hero shot with editorial background)
      sharp(imageBuffer)
        .extract(getExtractRegion(0))
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover', // Fill frame while maintaining aspect ratio
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 2: FRONT (Technical spec on white background)
      sharp(imageBuffer)
        .extract(getExtractRegion(1))
        .trim({
          background: { r: 255, g: 255, b: 255 }, // White background
          threshold: 20 // Tolerance for background detection
        })
        .resize({
          height: targetHeight,
          fit: 'inside',
          withoutEnlargement: false
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 3: SIDE (90° profile on white background)
      sharp(imageBuffer)
        .extract(getExtractRegion(2))
        .trim({
          background: { r: 255, g: 255, b: 255 },
          threshold: 20
        })
        .resize({
          height: targetHeight,
          fit: 'inside',
          withoutEnlargement: false
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 4: BACK (Rear view on white background)
      sharp(imageBuffer)
        .extract(getExtractRegion(3))
        .trim({
          background: { r: 255, g: 255, b: 255 },
          threshold: 20
        })
        .resize({
          height: targetHeight,
          fit: 'inside',
          withoutEnlargement: false
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

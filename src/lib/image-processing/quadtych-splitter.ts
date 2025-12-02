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

export interface PanelCoordinates {
  left: number;
  right: number;
}

export interface DetectionCoordinates {
  main: PanelCoordinates;
  front: PanelCoordinates;
  side: PanelCoordinates;
  back: PanelCoordinates;
  total_width: number;
}

/**
 * Split a 21:9 ultra-wide image into 4 equal vertical panels
 * Each panel will be approximately 5.25:9 → resized to 9:16 (mobile-friendly)
 *
 * @param base64Image - Base64-encoded image data (with or without data URL prefix)
 * @param targetHeight - Target height for output images (default: 1600px)
 * @param coordinates - Optional Gemini-detected panel coordinates (v7.0 - AI-based detection)
 * @returns Object with 4 panel buffers
 */
export async function splitQuadtych(
  base64Image: string,
  targetHeight: number = 1600,
  coordinates?: DetectionCoordinates
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

    // PANEL EXTRACTION STRATEGY (v7.0 - AI-based Detection)
    //
    // NEW STRATEGY (v7.0): Use Gemini AI to detect black separator bars
    // - Gemini Flash analyzes the 21:9 image
    // - Detects THICK BLACK VERTICAL BARS (>10px)
    // - Returns precise left/right coordinates for each panel
    // - Completely excludes black bars from extracted panels
    // - Fallback to v6.9 uniform trim if detection fails
    //
    // ROLLBACK HISTORY:
    // v6.9: Uniform 8% trim - black bars remained
    // v6.7-6.8: Asymmetric trim - content misalignment
    // v6.0-6.1: First AI detection attempt - unstable

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    let mainExtract, frontExtract, sideExtract, backExtract;

    if (coordinates) {
      // v7.0: Use Gemini-detected coordinates
      console.log('[quadtych-splitter] Using AI-detected coordinates (v7.0):', {
        main: `left: ${coordinates.main.left}px, right: ${coordinates.main.right}px`,
        front: `left: ${coordinates.front.left}px, right: ${coordinates.front.right}px`,
        side: `left: ${coordinates.side.left}px, right: ${coordinates.side.right}px`,
        back: `left: ${coordinates.back.left}px, right: ${coordinates.back.right}px`,
      });

      mainExtract = {
        left: coordinates.main.left,
        top: 0,
        width: coordinates.main.right - coordinates.main.left,
        height: panelHeight
      };

      frontExtract = {
        left: coordinates.front.left,
        top: 0,
        width: coordinates.front.right - coordinates.front.left,
        height: panelHeight
      };

      sideExtract = {
        left: coordinates.side.left,
        top: 0,
        width: coordinates.side.right - coordinates.side.left,
        height: panelHeight
      };

      backExtract = {
        left: coordinates.back.left,
        top: 0,
        width: coordinates.back.right - coordinates.back.left,
        height: panelHeight
      };
    } else {
      // v6.9: Fallback to uniform trim
      console.log('[quadtych-splitter] Falling back to uniform trim (v6.9)');

      const basePanelWidth = Math.floor(originalWidth / 4);
      const TRIM_RATIO = 0.08;
      const trimPixels = Math.floor(basePanelWidth * TRIM_RATIO);
      const panelWidth = basePanelWidth - (trimPixels * 2);

      mainExtract = {
        left: 0 + trimPixels,
        top: 0,
        width: panelWidth,
        height: panelHeight
      };

      frontExtract = {
        left: (basePanelWidth * 1) + trimPixels,
        top: 0,
        width: panelWidth,
        height: panelHeight
      };

      sideExtract = {
        left: (basePanelWidth * 2) + trimPixels,
        top: 0,
        width: panelWidth,
        height: panelHeight
      };

      backExtract = {
        left: (basePanelWidth * 3) + trimPixels,
        top: 0,
        width: panelWidth,
        height: panelHeight
      };
    }

    // Extract 4 panels using detected or fallback coordinates
    const [mainBuffer, frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // PANEL 1: MAIN (Hero shot)
      sharp(imageBuffer)
        .extract(mainExtract)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: { r: 245, g: 245, b: 245 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 2: FRONT (Technical front view)
      sharp(imageBuffer)
        .extract(frontExtract)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: { r: 245, g: 245, b: 245 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 3: SIDE (Technical side profile)
      sharp(imageBuffer)
        .extract(sideExtract)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: { r: 245, g: 245, b: 245 }
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 4: BACK (Technical rear view)
      sharp(imageBuffer)
        .extract(backExtract)
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

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

    // DYNAMIC SEPARATOR DETECTION (松案 - Optimal Solution)
    // Gemini generates 21:9 images with white separators, but positions vary between generations
    // Strategy: Detect MAIN→FRONT boundary (20-35% range), then split remaining equally

    const rawImage = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: rawBuffer, info } = rawImage;
    const channels = info.channels;

    console.log('[quadtych-splitter] Raw buffer info:', {
      width: info.width,
      height: info.height,
      channels,
      bufferSize: rawBuffer.length
    });

    // Detect MAIN→FRONT separator (white line in 20-40% range)
    // Strategy: Find white line clusters (4px width), pick the earliest valid one
    const searchStart = Math.floor(originalWidth * 0.20);
    const searchEnd = Math.floor(originalWidth * 0.40);
    const verticalSamplePoints = 20; // Increased sampling for better accuracy
    const whiteThreshold = 240; // RGB values > 240 considered white
    const minWhiteLineWidth = 3; // Minimum 3px wide white line

    let separator1 = Math.round(originalWidth * 0.276); // Fallback to percentage if detection fails
    let whiteCandidates: Array<{ position: number; width: number; confidence: number }> = [];

    console.log('[quadtych-splitter] Scanning for MAIN→FRONT separator:', {
      searchStart,
      searchEnd,
      range: `${searchStart}px - ${searchEnd}px`,
      verticalSamples: verticalSamplePoints,
      minWhiteLineWidth
    });

    // Scan for white separator line clusters
    let currentWhiteStreak = 0;
    let streakStartX = -1;

    for (let x = searchStart; x < searchEnd; x++) {
      let whitePixelCount = 0;

      // Sample vertical points along this column
      for (let sampleIdx = 0; sampleIdx < verticalSamplePoints; sampleIdx++) {
        const y = Math.floor((originalHeight / verticalSamplePoints) * sampleIdx);
        const pixelIndex = (y * info.width + x) * channels;

        const r = rawBuffer[pixelIndex];
        const g = rawBuffer[pixelIndex + 1];
        const b = rawBuffer[pixelIndex + 2];

        // Check if pixel is white
        if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
          whitePixelCount++;
        }
      }

      const isWhiteLine = whitePixelCount >= verticalSamplePoints * 0.8;

      if (isWhiteLine) {
        if (currentWhiteStreak === 0) {
          streakStartX = x;
        }
        currentWhiteStreak++;
      } else {
        // End of white streak - record if valid
        if (currentWhiteStreak >= minWhiteLineWidth) {
          const centerX = streakStartX + Math.floor(currentWhiteStreak / 2);
          const confidence = whitePixelCount / verticalSamplePoints;
          whiteCandidates.push({
            position: centerX,
            width: currentWhiteStreak,
            confidence
          });
          console.log('[quadtych-splitter] White line candidate found:', {
            position: centerX,
            width: currentWhiteStreak,
            percentage: ((centerX / originalWidth) * 100).toFixed(1) + '%'
          });
        }
        currentWhiteStreak = 0;
      }
    }

    // Select the FIRST valid white line candidate (closest to MAIN panel end)
    if (whiteCandidates.length > 0) {
      const selectedCandidate = whiteCandidates[0]; // First = earliest position
      separator1 = selectedCandidate.position;
      console.log('[quadtych-splitter] ✅ MAIN→FRONT separator selected:', {
        position: separator1,
        percentage: ((separator1 / originalWidth) * 100).toFixed(1) + '%',
        width: selectedCandidate.width,
        totalCandidates: whiteCandidates.length
      });
    } else {
      console.log('[quadtych-splitter] ⚠️ No white line detected, using fallback:', {
        position: separator1,
        percentage: ((separator1 / originalWidth) * 100).toFixed(1) + '%'
      });
    }

    // Calculate remaining separators by dividing the rest equally
    const remainingWidth = originalWidth - separator1;
    const panelWidth = Math.floor(remainingWidth / 3); // FRONT, SIDE, BACK are equal
    const separatorWidth = 4; // White line width

    const separator2 = separator1 + panelWidth;
    const separator3 = separator2 + panelWidth;

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    console.log('[quadtych-splitter] Final panel extraction coordinates:', {
      originalWidth,
      originalHeight,
      separator1: `${separator1}px (${((separator1 / originalWidth) * 100).toFixed(1)}%)`,
      separator2: `${separator2}px (${((separator2 / originalWidth) * 100).toFixed(1)}%)`,
      separator3: `${separator3}px (${((separator3 / originalWidth) * 100).toFixed(1)}%)`,
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

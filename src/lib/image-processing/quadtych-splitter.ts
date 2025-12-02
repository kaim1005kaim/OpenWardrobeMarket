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

    // PANEL BOUNDARY DETECTION (v5.3 - Person-Centered Extraction)
    // Strategy 1 (Primary): Use Gemini 1.5 Flash for semantic panel boundary detection
    // Strategy 2 (Fallback): Pixel-based variance detection with expanded search range (20-60%)

    interface PanelBounds {
      main: { left: number; right: number };
      front: { left: number; right: number };
      side: { left: number; right: number };
      back: { left: number; right: number };
    }

    let panelBounds: PanelBounds;
    let detectionMethod: 'gemini' | 'pixel' | 'fallback' = 'fallback';

    // STRATEGY 1: Try Gemini Flash detection first
    try {
      console.log('[quadtych-splitter] Attempting Gemini Flash panel detection...');

      const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const geminiResponse = await fetch(`${apiUrl}/api/gemini/detect-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: cleanBase64,
          mimeType: 'image/jpeg'
        }),
        signal: AbortSignal.timeout(15000) // 15s timeout
      });

      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();

        if (geminiResult.success && geminiResult.confidence !== 'low') {
          panelBounds = {
            main: geminiResult.main,
            front: geminiResult.front,
            side: geminiResult.side,
            back: geminiResult.back
          };
          detectionMethod = 'gemini';

          console.log('[quadtych-splitter] ✅ Gemini Flash detection successful:', {
            main: `${panelBounds.main.left}-${panelBounds.main.right}px (width: ${panelBounds.main.right - panelBounds.main.left}px)`,
            front: `${panelBounds.front.left}-${panelBounds.front.right}px (width: ${panelBounds.front.right - panelBounds.front.left}px)`,
            side: `${panelBounds.side.left}-${panelBounds.side.right}px (width: ${panelBounds.side.right - panelBounds.side.left}px)`,
            back: `${panelBounds.back.left}-${panelBounds.back.right}px (width: ${panelBounds.back.right - panelBounds.back.left}px)`,
            confidence: geminiResult.confidence,
            reasoning: geminiResult.reasoning
          });
        } else {
          throw new Error('Low confidence Gemini detection');
        }
      } else {
        throw new Error(`Gemini API failed: ${geminiResponse.status}`);
      }
    } catch (geminiError) {
      console.warn('[quadtych-splitter] Gemini detection failed, falling back to pixel analysis:', geminiError);

      // STRATEGY 2: Fallback to pixel-based detection
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

      // VERTICAL SEPARATOR LINE DETECTION (独立検出法 - Enhanced)
      // Strategy: Detect all 3 separator lines independently by finding vertical bands with uniform color
      // This works for white, gray, black, or any other separator color
      const verticalSamplePoints = 50; // Very high-res vertical sampling

      console.log('[quadtych-splitter] Scanning for vertical separator lines (pixel-based detection):', {
        verticalSamples: verticalSamplePoints,
        expectedSeparators: 3
      });

      // Function to calculate "separator score" for a vertical column
      // Higher score = more likely to be a separator (uniform color from top to bottom)
      const getColumnScore = (x: number, expectedPosition: number): number => {
        let rSum = 0, gSum = 0, bSum = 0;
        let rSqSum = 0, gSqSum = 0, bSqSum = 0;
        const samples = verticalSamplePoints;

        // Sample vertical line at regular intervals
        for (let i = 0; i < samples; i++) {
          const y = Math.floor((originalHeight / samples) * i);
          const idx = (y * info.width + x) * channels;
          const r = rawBuffer[idx];
          const g = rawBuffer[idx + 1];
          const b = rawBuffer[idx + 2];

          rSum += r; gSum += g; bSum += b;
          rSqSum += r * r; gSqSum += g * g; bSqSum += b * b;
        }

        // Calculate variance for each RGB channel
        const rVar = (rSqSum / samples) - Math.pow(rSum / samples, 2);
        const gVar = (gSqSum / samples) - Math.pow(gSum / samples, 2);
        const bVar = (bSqSum / samples) - Math.pow(bSum / samples, 2);

        const totalVariance = rVar + gVar + bVar;

        // Score: lower variance = higher score (more uniform = more likely separator)
        // +1 prevents division by zero
        let score = 10000 / (totalVariance + 1);

        // BRIGHTNESS FILTER: Ignore lines that are too dark (e.g., black clothes, shadows)
        // This prevents false positives from dark vertical elements in MAIN panel
        const avgBrightness = (rSum + gSum + bSum) / (3 * samples);
        if (avgBrightness < 50) {
          score = 0; // Too dark, not a separator
        }

        // POSITION PENALTY: Prefer positions closer to expected location
        // This prevents detecting edges at image boundaries
        const distFromExpected = Math.abs(x - expectedPosition);
        const positionPenalty = 1 / (1 + (distFromExpected * 0.05));

        return score * positionPenalty;
      };

      // Expected separator positions (EXPANDED RANGE for v5.0)
      // MAIN panel can now be 20-60% instead of just ~27%
      const expectedPositions = [
        Math.round(originalWidth * 0.40), // MAIN→FRONT (~40% - wider range)
        Math.round(originalWidth * 0.62), // FRONT→SIDE (~62%)
        Math.round(originalWidth * 0.81)  // SIDE→BACK (~81%)
      ];

      // EXPANDED search window: ±20% for first separator, ±10% for others
      const searchWindows = [
        Math.floor(originalWidth * 0.20), // MAIN: 20-60% search range
        Math.floor(originalWidth * 0.10), // FRONT: ±10%
        Math.floor(originalWidth * 0.10)  // SIDE: ±10%
      ];

      // Find best separator for each expected position
      const findBestSeparator = (expectedPos: number, searchWindow: number): { position: number; score: number } => {
        const startX = Math.max(0, expectedPos - searchWindow);
        const endX = Math.min(originalWidth - 1, expectedPos + searchWindow);

        let bestX = expectedPos; // Fallback to expected position
        let maxScore = -1;

        for (let x = startX; x <= endX; x++) {
          const score = getColumnScore(x, expectedPos);

          if (score > maxScore) {
            maxScore = score;
            bestX = x;
          }
        }

        return { position: bestX, score: maxScore };
      };

      const sep1Result = findBestSeparator(expectedPositions[0], searchWindows[0]);
      const sep2Result = findBestSeparator(expectedPositions[1], searchWindows[1]);
      const sep3Result = findBestSeparator(expectedPositions[2], searchWindows[2]);

      const separator1 = sep1Result.position;
      const separator2 = sep2Result.position;
      const separator3 = sep3Result.position;

      // Convert separator positions to panel bounds (fallback method)
      const separatorWidth = 4;
      panelBounds = {
        main: { left: 0, right: separator1 },
        front: { left: separator1 + separatorWidth, right: separator2 },
        side: { left: separator2 + separatorWidth, right: separator3 },
        back: { left: separator3 + separatorWidth, right: originalWidth }
      };

      // Validation: If score is too low (< 50), use expected position as fallback
      if (sep1Result.score < 50) {
        detectionMethod = 'fallback';
      } else {
        detectionMethod = 'pixel';
      }

      console.log('[quadtych-splitter] ✅ Pixel-based panel bounds detected:', {
        main: `${panelBounds.main.left}-${panelBounds.main.right}px (width: ${panelBounds.main.right - panelBounds.main.left}px)`,
        front: `${panelBounds.front.left}-${panelBounds.front.right}px (width: ${panelBounds.front.right - panelBounds.front.left}px)`,
        side: `${panelBounds.side.left}-${panelBounds.side.right}px (width: ${panelBounds.side.right - panelBounds.side.left}px)`,
        back: `${panelBounds.back.left}-${panelBounds.back.right}px (width: ${panelBounds.back.right - panelBounds.back.left}px)`,
        scores: {
          sep1: Math.round(sep1Result.score),
          sep2: Math.round(sep2Result.score),
          sep3: Math.round(sep3Result.score)
        }
      });
    }

    const panelHeight = originalHeight;
    const targetWidth = Math.floor(targetHeight * 9 / 16);

    console.log('[quadtych-splitter] Final panel extraction coordinates:', {
      detectionMethod, // v5.3: Shows which method was used (gemini/pixel/fallback)
      originalWidth,
      originalHeight,
      panelBounds,
      output: {
        targetWidth,
        targetHeight,
        aspectRatio: '9:16'
      }
    });

    // Extract 4 panels with person-centered boundaries (v5.3)
    const getExtractRegion = (panelName: 'main' | 'front' | 'side' | 'back') => {
      const bounds = panelBounds[panelName];
      return {
        left: bounds.left,
        top: 0,
        width: bounds.right - bounds.left,
        height: panelHeight
      };
    };

    const [mainBuffer, frontBuffer, sideBuffer, backBuffer] = await Promise.all([
      // PANEL 1: MAIN (Hero shot with editorial background)
      // v5.3: Person-centered extraction with Gemini Flash boundaries
      sharp(imageBuffer)
        .extract(getExtractRegion('main'))
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover', // Fill frame while maintaining aspect ratio
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 2: FRONT (Technical spec - preserve generated background)
      // v5.4: Cover crop to fill 9:16 frame, preserving generated background
      sharp(imageBuffer)
        .extract(getExtractRegion('front'))
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover', // Fill frame completely, crop if needed
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 3: SIDE (90° profile - preserve generated background)
      // v5.4: Cover crop to fill 9:16 frame, preserving generated background
      sharp(imageBuffer)
        .extract(getExtractRegion('side'))
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 95 })
        .toBuffer(),

      // PANEL 4: BACK (Rear view - preserve generated background)
      // v5.4: Cover crop to fill 9:16 frame, preserving generated background
      sharp(imageBuffer)
        .extract(getExtractRegion('back'))
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

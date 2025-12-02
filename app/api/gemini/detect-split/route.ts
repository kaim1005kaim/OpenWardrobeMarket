export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

/**
 * Gemini Flash-based Quadtych Boundary Detection
 *
 * Uses Gemini 1.5 Flash to visually identify the vertical boundary lines
 * between MAIN (editorial background) and FRONT/SIDE/BACK (white background) panels.
 *
 * This is FAR more reliable than pixel-based detection because:
 * - Gemini understands semantic boundaries (photo vs white background)
 * - Works regardless of separator color (white/gray/beige/none)
 * - Handles complex backgrounds (buildings, models, props)
 * - Doesn't get confused by vertical elements in MAIN panel
 */
export async function POST(req: NextRequest) {
  try {
    const { imageData, mimeType } = await req.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'imageData is required' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1, // Low temperature for precise coordinate detection
      }
    });

    const prompt = `You are analyzing a fashion design FILM STRIP image that contains 4 vertical panels arranged horizontally:

Panel Layout (left to right):
1. MAIN Panel: Editorial street snap / high fashion lookbook shot with stylish background
2. FRONT Panel: Technical front view on light gray/white background
3. SIDE Panel: 90° profile view on light gray/white background
4. BACK Panel: Rear view on light gray/white background

These panels are separated by THICK BLACK VERTICAL BARS (>10px width).

YOUR TASK:
Identify the LEFT and RIGHT boundaries for each of the 4 panels, so that:
- Each panel can be extracted cleanly WITHOUT any black separator bars
- MAIN panel captures the full editorial shot with background
- FRONT/SIDE/BACK panels are centered on the person with equal background padding on left/right

Detection Strategy:

PANEL 1 (MAIN - Editorial Shot):
- left: 0 (start of image)
- right: Find where the MAIN panel ends (before the first BLACK BAR)
  * Look for the thick black vertical bar (>10px wide)
  * The MAIN panel ends just before this black bar starts
  * Usually around 20-30% of image width

PANEL 2 (FRONT - Technical Front View):
- left: Find where the FRONT panel begins (after first BLACK BAR, with background padding)
  * Skip past the thick black bar completely
  * Start where there's clean background (light gray/white) on the left side of the person
- right: Find where the FRONT panel ends (before second BLACK BAR)
  * End where there's clean background on the right side of the person
  * Panel should be centered on the person with equal padding

PANEL 3 (SIDE - Technical Side View):
- left: Find where the SIDE panel begins (after second BLACK BAR, with background padding)
  * Skip past the thick black bar completely
  * Start where there's clean background on the left side of the person
- right: Find where the SIDE panel ends (before third BLACK BAR)
  * End where there's clean background on the right side of the person
  * Panel should be centered on the person with equal padding

PANEL 4 (BACK - Technical Rear View):
- left: Find where the BACK panel begins (after third BLACK BAR, with background padding)
  * Skip past the thick black bar completely
  * Start where there's clean background on the left side of the person
- right: End of image (or just before right edge)
  * Panel should be centered on the person

CRITICAL REQUIREMENTS:
- THICK BLACK BARS must be COMPLETELY EXCLUDED from all panels
- For FRONT/SIDE/BACK: Left/right boundaries should have EQUAL background padding
  * Person should be CENTERED within each panel
  * Background (light gray/white) should be visible on both sides
  * NO person cutoff on left or right edges
- MAIN panel should capture the full editorial composition
- Measure from the LEFT edge of the image (x=0)
- Return pixel coordinates, not percentages
- The black bars are VERY VISIBLE (>10px wide) so they should be easy to detect

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "main": { "left": 0, "right": number },
  "front": { "left": number, "right": number },
  "side": { "left": number, "right": number },
  "back": { "left": number, "right": number },
  "total_width": number,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of what you detected"
}`;

    console.log('[gemini/detect-split] Analyzing image with Gemini Flash...');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType || 'image/jpeg',
        },
      },
    ]);

    const response = result.response;
    const text = response.text();

    console.log('[gemini/detect-split] Raw response:', text);

    // Parse JSON response (remove markdown code blocks if present)
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    const detectionResult = JSON.parse(jsonStr);

    console.log('[gemini/detect-split] ✅ Detection result:', {
      main: `left: ${detectionResult.main.left}px, right: ${detectionResult.main.right}px (${((detectionResult.main.right / detectionResult.total_width) * 100).toFixed(1)}%)`,
      front: `left: ${detectionResult.front.left}px, right: ${detectionResult.front.right}px`,
      side: `left: ${detectionResult.side.left}px, right: ${detectionResult.side.right}px`,
      back: `left: ${detectionResult.back.left}px, right: ${detectionResult.back.right}px`,
      confidence: detectionResult.confidence,
      reasoning: detectionResult.reasoning
    });

    // Validation: Check if coordinates are reasonable
    const { main, front, side, back, total_width } = detectionResult;

    if (
      main.left !== 0 ||
      main.right <= 0 || main.right >= total_width ||
      front.left <= main.right || front.right <= front.left || front.right >= total_width ||
      side.left <= front.right || side.right <= side.left || side.right >= total_width ||
      back.left <= side.right || back.right <= back.left || back.right > total_width
    ) {
      console.error('[gemini/detect-split] ❌ Invalid coordinates detected:', detectionResult);
      return NextResponse.json(
        { error: 'Invalid panel coordinates detected', details: detectionResult },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...detectionResult
    });

  } catch (error: any) {
    console.error('[gemini/detect-split] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect split points', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

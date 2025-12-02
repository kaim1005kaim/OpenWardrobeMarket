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

    const prompt = `You are analyzing a fashion design image that contains 4 vertical panels arranged horizontally:

Panel Layout (left to right):
1. MAIN Panel: Editorial/cinematic shot with complex background (buildings, studio, landscape, etc.)
2. FRONT Panel: Technical front view on WHITE background
3. SIDE Panel: 90° profile view on WHITE background
4. BACK Panel: Rear view on WHITE background

These panels are separated by thin vertical separator lines (white, gray, beige, or other neutral colors).

YOUR TASK:
Identify the X-coordinates (in pixels) where each panel BEGINS (not where the separator starts).
We need to exclude the separator lines completely from each panel.

Detection Strategy:
- Separator 1 (MAIN→FRONT boundary):
  * Find where the complex/colored MAIN background ends
  * Look for the first pixel AFTER the separator line where the white FRONT background begins
  * This is usually between 20-60% of image width
  * Return the X coordinate where the FRONT panel's white background starts (人物が始まる位置)

- Separator 2 (FRONT→SIDE boundary):
  * Find the separator line between FRONT and SIDE panels
  * Return the X coordinate where the SIDE panel's white background starts (人物が始まる位置)
  * Usually around 50-55% of image width

- Separator 3 (SIDE→BACK boundary):
  * Find the separator line between SIDE and BACK panels
  * Return the X coordinate where the BACK panel's white background starts (人物が始まる位置)
  * Usually around 75-80% of image width

CRITICAL REQUIREMENTS:
- Return coordinates where each panel's CONTENT begins (NOT where separator starts)
- Separator lines should be EXCLUDED from all panels
- If a separator line is 4-10px wide, skip past it entirely
- Measure from the LEFT edge of the image (x=0)
- Return pixel coordinates, not percentages
- MAIN panel is typically wider (25-50% of total width)
- FRONT/SIDE/BACK panels are typically equal width (each ~15-25% of total width)

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "separator1": number,
  "separator2": number,
  "separator3": number,
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
      separator1: `${detectionResult.separator1}px (${((detectionResult.separator1 / detectionResult.total_width) * 100).toFixed(1)}%)`,
      separator2: `${detectionResult.separator2}px (${((detectionResult.separator2 / detectionResult.total_width) * 100).toFixed(1)}%)`,
      separator3: `${detectionResult.separator3}px (${((detectionResult.separator3 / detectionResult.total_width) * 100).toFixed(1)}%)`,
      confidence: detectionResult.confidence,
      reasoning: detectionResult.reasoning
    });

    // Validation: Check if coordinates are reasonable
    const { separator1, separator2, separator3, total_width } = detectionResult;

    if (
      separator1 < 0 || separator1 >= total_width ||
      separator2 < 0 || separator2 >= total_width ||
      separator3 < 0 || separator3 >= total_width ||
      separator1 >= separator2 ||
      separator2 >= separator3
    ) {
      console.error('[gemini/detect-split] ❌ Invalid coordinates detected:', detectionResult);
      return NextResponse.json(
        { error: 'Invalid separator coordinates detected', details: detectionResult },
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

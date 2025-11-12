export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { callVertexAIGemini } from '../../../../lib/vertex-ai-auth';

/**
 * POST /api/variants/check-view
 *
 * Validates that a generated variant image matches the expected view angle.
 * Uses Gemini Vision to classify the viewpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrl, expectedView } = await req.json();

    if (!imageUrl || !expectedView) {
      return NextResponse.json(
        { error: 'imageUrl and expectedView are required' },
        { status: 400 }
      );
    }

    console.log('[check-view] Validating view:', { imageUrl, expectedView });

    // Fetch image and convert to base64
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch image: ${imgRes.status}`);
    }

    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/png';

    // Gemini Vision classification prompt
    const prompt = `Analyze this fashion image and classify the camera viewpoint.

VIEWPOINT DEFINITIONS:
- front: Model facing camera, frontal torso visible, both eyes visible, nose and mouth visible
- side: Strict profile view, model turned 90° to camera, only one eye line implied, shoulders perpendicular to camera, no frontal facial features
- back: Model facing away from camera, back of head/torso visible, no face visible, shoulders square to camera
- 3q-front: Three-quarter front view, model turned ~45° toward camera, partial face visible
- 3q-back: Three-quarter back view, model turned ~45° away from camera, partial back visible
- unknown: Cannot determine or ambiguous

CLASSIFICATION CRITERIA:

SIDE VIEW requirements:
- Model's torso and head turned 90° relative to camera
- Only ONE side of the body visible
- Profile view of face (if face visible)
- NO frontal chest visible
- NO both eyes visible
- Shoulders perpendicular to camera

BACK VIEW requirements:
- Model facing away from camera
- Back of head and shoulders visible
- NO face visible (no eyes, nose, mouth)
- NO frontal torso
- Full back silhouette clear

FRONT VIEW indicators (should be rejected for side/back):
- Both eyes visible
- Nose and mouth clearly visible from front
- Frontal chest/torso visible
- Model facing toward camera

Return ONLY a JSON object with this exact format:
{
  "view": "front" | "side" | "back" | "3q-front" | "3q-back" | "unknown",
  "confidence": <number 0-1>,
  "reasons": ["reason1", "reason2", ...]
}

Example response:
{
  "view": "side",
  "confidence": 0.95,
  "reasons": [
    "Model's body is turned 90° to camera",
    "Only left side profile visible",
    "No frontal facial features visible",
    "Shoulders perpendicular to camera"
  ]
}`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64
            }
          },
          { text: prompt }
        ]
      }
    ];

    const result = await callVertexAIGemini(
      'gemini-2.0-flash-exp',
      contents,
      {
        temperature: 0.1,
        maxOutputTokens: 512
      },
      undefined,
      { timeout: 20000 }
    );

    // Parse response
    const text = result.candidates[0].content.parts[0].text;
    console.log('[check-view] Gemini response:', text);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const classification = JSON.parse(jsonMatch[0]);
    const { view, confidence, reasons } = classification;

    // Validate result
    const ok = view === expectedView && confidence >= 0.7;

    console.log('[check-view] Result:', {
      expectedView,
      detectedView: view,
      confidence,
      ok,
      reasons
    });

    return NextResponse.json({
      ok,
      detectedView: view,
      confidence,
      reasons
    });

  } catch (error) {
    console.error('[check-view] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'View validation failed',
        ok: false,
        detectedView: 'unknown',
        confidence: 0
      },
      { status: 500 }
    );
  }
}

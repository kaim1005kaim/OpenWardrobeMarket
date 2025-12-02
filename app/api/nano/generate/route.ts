export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 120; // 2 minutes for FUSION triptych generation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { randomUUID } from 'node:crypto';
import { splitTriptych } from '../../../../src/lib/image-processing/triptych-splitter';
import { splitQuadtych } from '../../../../src/lib/image-processing/quadtych-splitter';
import https from 'https';
import dns from 'dns';

// Configure DNS to prefer IPv4 (fixes SSL handshake issues with some APIs)
dns.setDefaultResultOrder('ipv4first');

// TEMPORARY FIX: Disable SSL certificate validation for Google AI API
// This is a workaround for SSL/TLS handshake failures on Vercel
// TODO: Find a proper solution that doesn't compromise security
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Override global HTTPS agent to bypass SSL issues
const originalHttpsAgent = https.globalAgent;
https.globalAgent = new https.Agent({
  rejectUnauthorized: false,
  requestCert: false,
  // Additional SSL bypass options
  checkServerIdentity: () => undefined,
  maxVersion: 'TLSv1.3',
});

console.log('[nano/generate] ⚠️  SSL verification disabled with custom global HTTPS agent (temporary fix)');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// R2 configuration with custom HTTPS agent
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      requestCert: false,
      checkServerIdentity: () => undefined,
      maxVersion: 'TLSv1.3',
      minVersion: 'TLSv1.2',
    }),
  }),
  tls: false, // Disable TLS verification at SDK level
});

const R2_BUCKET = process.env.R2_BUCKET!;
// Use public domain URL (fallback to NEXT_PUBLIC_R2_PUBLIC_BASE_URL or hardcoded public URL)
const R2_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  process.env.R2_PUBLIC_BASE_URL ||
  'https://assets.open-wardrobe-market.com';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // v2.0 TEMPORARY: Allow anonymous access for FUSION migration
    // TODO: Re-enable authentication check before production launch
    let user: any = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const {
        data: { user: authenticatedUser },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (!authError && authenticatedUser) {
        user = authenticatedUser;
      }
    }

    // If no authenticated user, use anonymous user ID
    if (!user) {
      user = { id: 'anonymous' };
      console.log('[nano/generate] Anonymous user request');
    }

    const body = await req.json();
    const {
      prompt,
      negative,
      aspectRatio,
      answers,
      dna,
      parentAssetId,
      enableTriptych = false, // v2.0: Enable 3-panel generation (deprecated)
      enableQuadtych = false, // v4.0: Enable 4-panel generation (MAIN + 3-view)
      fusionConcept // v2.0: Design philosophy for metadata
    } = body;

    if (!prompt || !dna) {
      return NextResponse.json(
        { error: 'prompt and dna are required' },
        { status: 400 }
      );
    }

    console.log('[nano/generate] Request:', {
      user_id: user.id,
      prompt,
      aspectRatio,
      parentAssetId,
      enableTriptych,
      enableQuadtych,
      fusionConcept: fusionConcept ? fusionConcept.substring(0, 100) + '...' : null
    });

    // Generate image with Gemini using direct REST API (bypasses @google/genai SSL issues)
    const cleanNegative = (negative || '')
      .replace(/no watermark|no signature/gi, '')
      .replace(/,,/g, ',')
      .trim();

    // v3.6: FUSION Character Sheet - Generate triptych WITHOUT text labels
    // v4.0: FUSION Quadtych - Generate MAIN + 3-view WITHOUT text labels
    // v5.2: Removed text labels from prompt structure to prevent rendering
    // v6.2: Rollback to stable v5.1 simple prompt (equal panels, thin white separators)
    // v6.4: Add stylish color-coordinated background to PANEL 1

    // Extract palette from DNA for background color suggestions
    const paletteColors = dna?.palette?.map((c: any) => c.name || c.hex).join(', ') || 'garment colors';

    let fullPrompt: string;
    if (enableQuadtych) {
      // v6.4: All panels equal weight + stylish color background for PANEL 1
      fullPrompt = `
Create a fashion design reference sheet in 21:9 ultra-wide format showing the SAME outfit from 4 different angles.

CRITICAL LAYOUT RULES:
- Format: 4 EQUAL-WIDTH vertical panels side by side (like a film strip)
- Aspect Ratio: 21:9 (ultra-wide horizontal)
- Each panel: EXACTLY SAME WIDTH (divide total width by 4)
- All panels: EQUAL IMPORTANCE (no panel is special or larger)
- Separators: THIN WHITE LINES (2-3 pixels) between panels
- NO black bars, NO text labels, NO overlapping

PANEL 1 (Far Left) - Main View:
- Full body shot, standing or casual pose
- Background: Stylish background that complements the garment's color palette
  * Use colors from the outfit palette: ${paletteColors}
  * Options: solid color wall, gradient backdrop, urban architecture, minimal interior, or abstract geometric shapes
  * The background should enhance the design without overwhelming it
  * Keep it clean and modern
- Lighting: Even, natural lighting with slight drama
- Framing: Full body from head to toe with 15% headroom, 10% footroom

PANEL 2 (Middle Left) - Front View:
- Standing straight, arms at sides, facing camera
- Background: Clean light gray or white studio background
- Lighting: Even, flat lighting
- Framing: Full body from head to toe with 15% headroom, 10% footroom

PANEL 3 (Middle Right) - Side View:
- 90-degree side profile, facing right
- Standing straight, arms at sides
- Background: Clean light gray or white studio background
- Lighting: Even, flat lighting
- Framing: Full body from head to toe with 15% headroom, 10% footroom

PANEL 4 (Far Right) - Back View:
- Rear view (facing away), standing straight
- Background: Clean light gray or white studio background
- Lighting: Even, flat lighting
- Framing: Full body from head to toe with 15% headroom, 10% footroom

CONSISTENCY REQUIREMENTS:
1. SAME PERSON in all 4 panels (identical face, body, skin tone)
2. SAME OUTFIT in all 4 panels (identical garment, colors, patterns, details)
3. ALL 4 PANELS have EQUAL WIDTH and EQUAL TREATMENT
4. NO cropping of head or feet in ANY panel

[FRAMING & COMPOSITION]
- HEADROOM: Leave 15% empty space above the model's head in all panels.
- FOOTROOM: Show the full feet and shoes with ground shadow.
- DO NOT cut the head or feet in any panel.
- VISUAL SEPARATION: Use thin white lines to separate the four panels.

[CLEAN IMAGE RULES - CRITICAL]
- NO TEXT. NO LABELS. NO TYPOGRAPHY. NO WATERMARKS.
- DO NOT write "MAIN", "FRONT", "SIDE", "BACK" or any other text on the image.
- Keep backgrounds clean and free of any writing or symbols.
- NO logos, NO brand names, NO signatures, NO captions.

[DESIGN SPECIFICATIONS]
${prompt}

[QUALITY]
Hyper-realistic texture, 8k resolution, professional fashion photography.
Panel 1: Editorial magazine quality with atmospheric lighting.
Panels 2-4: Technical spec sheet quality with clean white backgrounds.
Negative: text, label, word, writing, signature, watermark, typography, caption, title, letter, alphabet, logo, brand name, cropped head, cut off head, cut off feet, out of frame, close up, portrait shot, partial head, partial feet, zooming in${cleanNegative ? `, ${cleanNegative}` : ''}
      `.trim();
    } else if (enableTriptych) {
      // Fashion Character Sheet format for perfect identity consistency
      fullPrompt = `
Create a photorealistic FASHION CHARACTER SHEET.
Format: Horizontal Triptych (3 side-by-side panels) with Aspect Ratio 16:9.

[LAYOUT REQUIREMENTS]
The image must be split into 3 vertical sections:
- LEFT: Full-body FRONT VIEW (Straight standing pose, facing camera)
- CENTER: Full-body SIDE VIEW (90-degree profile, facing right)
- RIGHT: Full-body BACK VIEW (Straight standing pose, back to camera)

[FRAMING & COMPOSITION]
- Camera Distance: EXTREME LONG SHOT (Capture full body from head to toe with ample space)
- HEADROOM: Leave 15% empty space above the model's head. DO NOT CUT THE HEAD.
- FOOTROOM: Show the full feet and shoes with ground shadow. Do not cut the feet.
- VISUAL SEPARATION: Use thin white lines to separate the three panels.
- The entire head and hair must be fully visible with generous padding
- Leave padding at the top and bottom of the frame

[CLEAN IMAGE RULES - CRITICAL]
- NO TEXT. NO LABELS. NO TYPOGRAPHY. NO WATERMARKS.
- DO NOT write "FRONT", "SIDE", "BACK" or any other text on the image.
- Keep the background completely clean, empty, and free of any writing or symbols.
- NO logos, NO brand names, NO signatures, NO captions.

[CRITICAL CONSISTENCY]
- The model MUST be the EXACT SAME person in all three panels
- The outfit MUST be IDENTICAL in material, color, and design details across all views
- Skin texture and fabric details must be hyper-realistic
- Maintain perfect identity and clothing consistency

[DESIGN SPECIFICATIONS]
${prompt}

[QUALITY]
Hyper-realistic texture, 8k resolution, studio lighting, fashion magazine quality.
Background: Clean neutral studio background (white or light grey).
Negative: text, label, word, writing, signature, watermark, typography, caption, title, letter, alphabet, logo, brand name, cropped head, cut off head, cut off feet, out of frame, close up, portrait shot, partial head, partial feet, zooming in${cleanNegative ? `, ${cleanNegative}` : ''}
      `.trim();
    } else {
      // Legacy single image mode
      fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${
        cleanNegative ? `. Negative: ${cleanNegative}` : ''
      }`;
    }

    // v3.0: For FUSION mode with triptych, generate 16:9 horizontal image
    // v4.0: For FUSION mode with quadtych, generate 21:9 ultra-wide image
    const targetAspectRatio = enableQuadtych ? '21:9' : (enableTriptych ? '16:9' : (aspectRatio || '3:4'));

    console.log('[nano/generate] Full prompt:', fullPrompt);
    console.log('[nano/generate] Target aspect ratio:', targetAspectRatio);

    // v2.0: Use Nano Banana Pro (Gemini 3 Pro Image Preview) via REST API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${process.env.GOOGLE_API_KEY!}`;

    const fetchResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }],
        }],
        generationConfig: {
          imageConfig: { aspectRatio: targetAspectRatio },
        },
      }),
    });

    if (!fetchResp.ok) {
      const errorText = await fetchResp.text();
      console.error('[nano/generate] Google AI API error:', errorText);
      throw new Error(`Google AI API error: ${fetchResp.status}`);
    }

    const resp = await fetchResp.json();
    const parts: any[] = resp.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p: any) => p.inlineData)?.inlineData;

    if (!inline?.data) {
      console.error('[nano/generate] No image data in response');
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // v2.0: If triptych mode, split the image into 3 panels
    // v4.0: If quadtych mode, split the image into 4 panels
    let triptychPanels: any = null;
    let quadtychPanels: any = null;
    let originalImageUrl: string | null = null;

    if (enableQuadtych) {
      console.log('[nano/generate] Splitting into quadtych panels (MAIN + 3-view)...');
      try {
        // v4.0: Upload original 21:9 image to R2 for debugging
        const originalImageBuffer = Buffer.from(inline.data, 'base64');
        const originalKey = `fusion/${user.id}/debug/${Date.now()}-original-21x9.jpg`;

        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: originalKey,
            Body: originalImageBuffer,
            ContentType: 'image/jpeg',
          })
        );

        originalImageUrl = `${R2_PUBLIC_BASE_URL}/${originalKey}`;
        console.log('[nano/generate] 🖼️  ORIGINAL 21:9 IMAGE URL:', originalImageUrl);

        const panels = await splitQuadtych(inline.data);
        // Convert Buffers to base64
        quadtychPanels = {
          main: {
            ...panels.main,
            base64: panels.main.buffer.toString('base64'),
          },
          front: {
            ...panels.front,
            base64: panels.front.buffer.toString('base64'),
          },
          side: {
            ...panels.side,
            base64: panels.side.buffer.toString('base64'),
          },
          back: {
            ...panels.back,
            base64: panels.back.buffer.toString('base64'),
          },
        };
        console.log('[nano/generate] Successfully split into 4 panels with base64 conversion');
      } catch (error) {
        console.error('[nano/generate] Failed to split quadtych:', error);
        return NextResponse.json(
          { error: 'Failed to split quadtych image' },
          { status: 500 }
        );
      }
    } else if (enableTriptych) {
      console.log('[nano/generate] Splitting into triptych panels...');
      try {
        // v3.3: Upload original 16:9 image to R2 for debugging
        const originalImageBuffer = Buffer.from(inline.data, 'base64');
        const originalKey = `fusion/${user.id}/debug/${Date.now()}-original-16x9.jpg`;

        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: originalKey,
            Body: originalImageBuffer,
            ContentType: 'image/jpeg',
          })
        );

        originalImageUrl = `${R2_PUBLIC_BASE_URL}/${originalKey}`;
        console.log('[nano/generate] 🖼️  ORIGINAL 16:9 IMAGE URL:', originalImageUrl);

        const panels = await splitTriptych(inline.data);
        // Convert Buffers to base64
        triptychPanels = {
          front: {
            ...panels.front,
            base64: panels.front.buffer.toString('base64'),
          },
          side: {
            ...panels.side,
            base64: panels.side.buffer.toString('base64'),
          },
          back: {
            ...panels.back,
            base64: panels.back.buffer.toString('base64'),
          },
        };
        console.log('[nano/generate] Successfully split into 3 panels with base64 conversion');
      } catch (error) {
        console.error('[nano/generate] Failed to split triptych:', error);
        return NextResponse.json(
          { error: 'Failed to split triptych image' },
          { status: 500 }
        );
      }
    }

    // v2.0 WORKAROUND: Return base64 instead of uploading to R2 (Vercel SSL issues)
    // The mobile app will handle R2 upload via /api/upload-to-r2
    const mimeType = inline.mimeType || 'image/png';

    console.log('[nano/generate] Returning base64 image data (R2 upload bypassed due to Vercel SSL issues)');

    if (enableQuadtych && quadtychPanels) {
      // v4.0: Return quadtych panels as base64 (MAIN + 3-view)
      return NextResponse.json({
        success: true,
        quadtych: true,
        imageData: {
          main: quadtychPanels.main.base64,
          front: quadtychPanels.front.base64,
          side: quadtychPanels.side.base64,
          back: quadtychPanels.back.base64,
        },
        mimeType: 'image/jpeg',
        metadata: {
          prompt,
          dna,
          parentAssetId,
          fusionConcept,
          aspectRatio: targetAspectRatio,
          originalImageUrl, // v4.0: Include original 21:9 image URL for debugging
        },
      });
    } else if (enableTriptych && triptychPanels) {
      // Return triptych panels as base64
      return NextResponse.json({
        success: true,
        triptych: true,
        imageData: {
          front: triptychPanels.front.base64,
          side: triptychPanels.side.base64,
          back: triptychPanels.back.base64,
        },
        mimeType: 'image/jpeg',
        metadata: {
          prompt,
          dna,
          parentAssetId,
          fusionConcept,
          aspectRatio: targetAspectRatio,
          originalImageUrl, // v3.3: Include original 16:9 image URL for debugging
        },
      });
    } else {
      // Return single image as base64
      return NextResponse.json({
        success: true,
        triptych: false,
        imageData: inline.data,
        mimeType: mimeType,
        metadata: {
          prompt,
          dna,
          parentAssetId,
          aspectRatio: targetAspectRatio,
        },
      });
    }
  } catch (error: any) {
    console.error('[nano/generate] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

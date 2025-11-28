export const runtime = 'nodejs';
export const revalidate = 0;
export const maxDuration = 120; // 2 minutes for FUSION triptych generation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { randomUUID } from 'node:crypto';
import { splitTriptych } from '../../../../src/lib/image-processing/triptych-splitter';
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
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

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
      enableTriptych = false, // v2.0: Enable 3-panel generation
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
      fusionConcept: fusionConcept ? fusionConcept.substring(0, 100) + '...' : null
    });

    // Generate image with Gemini using direct REST API (bypasses @google/genai SSL issues)
    const cleanNegative = (negative || '')
      .replace(/no watermark|no signature/gi, '')
      .replace(/,,/g, ',')
      .trim();

    // v3.1: FUSION Character Sheet - Generate triptych with proper framing
    let fullPrompt: string;
    if (enableTriptych) {
      // Fashion Character Sheet format for perfect identity consistency
      fullPrompt = `
Create a photorealistic FASHION CHARACTER SHEET.
Format: Horizontal Triptych (3 side-by-side panels) with Aspect Ratio 16:9.

[LAYOUT REQUIREMENTS]
The image must be split into 3 vertical sections:
- LEFT: Full-body FRONT VIEW (Straight standing pose, facing camera)
- CENTER: Full-body SIDE VIEW (90-degree profile, facing right)
- RIGHT: Full-body BACK VIEW (Straight standing pose, back to camera)

[FRAMING CRITERIA]
- Camera Distance: LONG SHOT (Wide shot capturing head to toe)
- HEADROOM: Include clear empty space above the model's head
- DO NOT CROP THE HEAD. The entire head and hair must be fully visible
- Leave padding at the top and bottom of the frame
- Text labels "FRONT", "SIDE", "BACK" are allowed at the bottom of each panel

[CRITICAL CONSISTENCY]
- The model MUST be the EXACT SAME person in all three panels
- The outfit MUST be IDENTICAL in material, color, and design details across all views
- Skin texture and fabric details must be hyper-realistic
- Maintain perfect identity and clothing consistency

[DESIGN SPECIFICATIONS]
${prompt}

[QUALITY]
Hyper-realistic texture, 8k resolution, fashion magazine quality.
Background: Clean neutral studio background (white or light grey).
Negative: cropped head, cut off head, out of frame, close up, portrait shot, partial head, zooming in${cleanNegative ? `, ${cleanNegative}` : ''}
      `.trim();
    } else {
      // Legacy single image mode
      fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${
        cleanNegative ? `. Negative: ${cleanNegative}` : ''
      }`;
    }

    // v3.0: For FUSION mode with triptych, generate 16:9 horizontal image
    const targetAspectRatio = enableTriptych ? '16:9' : (aspectRatio || '3:4');

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
    let triptychPanels: any = null;
    if (enableTriptych) {
      console.log('[nano/generate] Splitting into triptych panels...');
      try {
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

    if (enableTriptych && triptychPanels) {
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

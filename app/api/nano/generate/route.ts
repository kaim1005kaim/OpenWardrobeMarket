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
    httpsAgent: https.globalAgent,
  }),
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

    const fullPrompt = `${prompt} | single model | one person only | clean minimal background | fashion lookbook style | full body composition | professional fashion photography${
      cleanNegative ? `. Negative: ${cleanNegative}` : ''
    }`;

    // v2.0: For FUSION mode with triptych, generate 16:9 horizontal image
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
        triptychPanels = panels;
        console.log('[nano/generate] Successfully split into 3 panels');
      } catch (error) {
        console.error('[nano/generate] Failed to split triptych:', error);
        return NextResponse.json(
          { error: 'Failed to split triptych image' },
          { status: 500 }
        );
      }
    }

    // v2.0: Upload to R2 (either single image or triptych panels)
    const mimeType = inline.mimeType || 'image/png';
    const ext = mimeType.includes('webp') ? 'webp' : 'jpg';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    let imageUrl: string;
    let key: string;
    let triptychUrls: any = null;

    if (enableTriptych && triptychPanels) {
      // Upload 3 separate panels
      const baseKey = `generated/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}`;

      const panelUploads = await Promise.all([
        // Front panel
        r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: `${baseKey}_front.jpg`,
            Body: triptychPanels.front.buffer,
            ContentType: 'image/jpeg',
          })
        ),
        // Side panel
        r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: `${baseKey}_side.jpg`,
            Body: triptychPanels.side.buffer,
            ContentType: 'image/jpeg',
          })
        ),
        // Back panel
        r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: `${baseKey}_back.jpg`,
            Body: triptychPanels.back.buffer,
            ContentType: 'image/jpeg',
          })
        )
      ]);

      triptychUrls = {
        front: `${R2_PUBLIC_BASE_URL}/${baseKey}_front.jpg`,
        side: `${R2_PUBLIC_BASE_URL}/${baseKey}_side.jpg`,
        back: `${R2_PUBLIC_BASE_URL}/${baseKey}_back.jpg`
      };

      // Use front panel as primary image
      imageUrl = triptychUrls.front;
      key = `${baseKey}_front.jpg`;

      console.log('[nano/generate] Uploaded triptych panels to R2:', triptychUrls);
    } else {
      // Single image upload (legacy mode)
      key = `generated/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}.${ext}`;
      const buffer = Buffer.from(inline.data, 'base64');

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      imageUrl = `${R2_PUBLIC_BASE_URL}/${key}`;
      console.log('[nano/generate] Uploaded to R2:', imageUrl);
    }

    // Save to generation_history with DNA
    const { data: historyRecord, error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        image_path: key,
        prompt: prompt,
        dna: dna,
        parent_asset_id: parentAssetId || null,
        is_public: false,
      })
      .select()
      .single();

    if (historyError) {
      console.error('[nano/generate] Failed to save to generation_history:', historyError);
    } else {
      console.log('[nano/generate] Saved to generation_history:', historyRecord.id);
    }

    // Save to assets table with DNA and lineage
    const { data: assetRecord, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        final_url: imageUrl,
        final_key: key,
        status: 'private',
        dna: dna,
        parent_asset_id: parentAssetId || null,
        lineage_tags: parentAssetId ? ['remix'] : [],
        metadata: {
          width: 1024,
          height: aspectRatio === '3:4' ? 1365 : 1024,
          mime_type: mimeType,
          // v2.0: Triptych metadata
          ...(enableTriptych && triptychUrls ? {
            triptych: true,
            triptych_urls: triptychUrls,
            fusion_concept: fusionConcept
          } : {})
        },
      })
      .select()
      .single();

    if (assetError) {
      console.error('[nano/generate] Failed to save to assets:', assetError);
      return NextResponse.json(
        { error: 'Failed to save asset: ' + assetError.message },
        { status: 500 }
      );
    }

    console.log('[nano/generate] Created asset:', assetRecord.id);

    return NextResponse.json({
      // Mobile app compatibility
      generationId: assetRecord.id,
      imageUrl: imageUrl,
      // Legacy fields
      id: assetRecord.id,
      url: imageUrl,
      key: key,
      historyId: historyRecord?.id,
      // v2.0: Include triptych URLs if available
      ...(enableTriptych && triptychUrls ? {
        triptych: true,
        triptych_urls: triptychUrls,
        frontUrl: triptychUrls.front,
        sideUrl: triptychUrls.side,
        backUrl: triptychUrls.back,
      } : {})
    });
  } catch (error: any) {
    console.error('[nano/generate] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

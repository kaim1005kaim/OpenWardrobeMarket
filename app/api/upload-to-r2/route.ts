export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import https from 'https';
import dns from 'dns';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Configure DNS to prefer IPv4
dns.setDefaultResultOrder('ipv4first');

// TEMPORARY FIX: Disable SSL certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use enhanced SSL bypass configuration (same as nano/generate)
const r2Client = new S3Client({
  endpoint: process.env.R2_S3_ENDPOINT!,
  region: 'auto',
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

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // v2.0 TEMPORARY: Allow anonymous access for FUSION migration
    // TODO: Re-enable authentication check before production launch
    let user: any = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authenticatedUser) {
        user = authenticatedUser;
      }
    }

    // If no authenticated user, use anonymous user ID
    if (!user) {
      user = { id: 'anonymous' };
      console.log('[upload-to-r2] Anonymous user request');
    }

    const body = await req.json();
    const { imageData, mimeType, metadata } = body;

    if (!imageData || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: imageData, mimeType' },
        { status: 400 }
      );
    }

    // Generate R2 key
    const ext = mimeType.includes('webp') ? 'webp' : 'jpg';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const key = `generated/${user.id}/${yyyy}/${mm}/${Date.now()}_${randomUUID()}.${ext}`;

    console.log('[upload-to-r2] Uploading to R2:', key);

    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await r2Client.send(command);

    // Generate public URL
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL!;
    const finalUrl = `${publicBaseUrl}/${key}`;

    console.log('[upload-to-r2] Upload successful:', finalUrl);

    // Create Supabase client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Save to generation_history
    const { data: historyRecord, error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id: user.id,
        image_url: finalUrl,
        image_path: key,
        prompt: metadata?.prompt || '',
        dna: metadata?.dna || null,
        parent_asset_id: metadata?.parentAssetId || null,
        is_public: false,
      })
      .select()
      .single();

    if (historyError) {
      console.error('[upload-to-r2] Failed to save to generation_history:', historyError);
    }

    // Save to assets table
    const { data: assetRecord, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        final_url: finalUrl,
        final_key: key,
        status: 'private',
        dna: metadata?.dna || null,
        parent_asset_id: metadata?.parentAssetId || null,
        lineage_tags: metadata?.parentAssetId ? ['remix'] : [],
        metadata: {
          width: 1024,
          height: metadata?.aspectRatio === '3:4' ? 1365 : 1024,
          mime_type: mimeType,
        },
      })
      .select()
      .single();

    if (assetError) {
      console.error('[upload-to-r2] Failed to save to assets:', assetError);
      return NextResponse.json(
        { error: 'Failed to save asset: ' + assetError.message },
        { status: 500 }
      );
    }

    console.log('[upload-to-r2] Created asset:', assetRecord.id);

    return NextResponse.json({
      success: true,
      generationId: assetRecord.id,
      imageUrl: finalUrl,
      key,
    });

  } catch (error: any) {
    console.error('[upload-to-r2] Error:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import https from 'https';
import dns from 'dns';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use same R2 client configuration as r2-presign (with SSL/TLS fix)
const r2Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      keepAlive: true,
      // IPv6経路の相性切り分け：IPv4を優先
      lookup: (host, options, cb) => dns.lookup(host, { ...options, family: 4 }, cb),
      minVersion: 'TLSv1.2',
    }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { imageData, mimeType, key } = body;

    if (!imageData || !mimeType || !key) {
      return NextResponse.json(
        { error: 'Missing required fields: imageData, mimeType, key' },
        { status: 400 }
      );
    }

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
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || 'https://pub-4215f2149d4e4f369c2bde9f2769dfd4.r2.dev';
    const finalUrl = `${publicBaseUrl}/${key}`;

    console.log('[upload-to-r2] Upload successful:', finalUrl);

    return NextResponse.json({
      success: true,
      url: finalUrl,
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

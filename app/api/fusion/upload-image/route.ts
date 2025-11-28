export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import https from 'https';
import dns from 'dns';

// Configure DNS to prefer IPv4
dns.setDefaultResultOrder('ipv4first');

// TEMPORARY FIX: Disable SSL certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use enhanced SSL bypass configuration
const r2Client = new S3Client({
  endpoint: process.env.R2_S3_ENDPOINT!,
  region: 'auto',
  forcePathStyle: true, // Avoid bucket-in-hostname to prevent TLS CN mismatch
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

/**
 * Upload FUSION source images to R2
 * Lightweight endpoint - no database, just upload and return URL
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[fusion/upload-image] Received upload request');

    const body = await req.json();
    const { imageData, mimeType } = body;

    if (!imageData || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: imageData, mimeType' },
        { status: 400 }
      );
    }

    // Generate R2 key for FUSION images
    const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : 'jpg';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const key = `fusion/anonymous/${timestamp}-${randomStr}.${ext}`;

    console.log('[fusion/upload-image] Uploading to R2:', key);

    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');
    console.log('[fusion/upload-image] Buffer size:', buffer.length, 'bytes');

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

    console.log('[fusion/upload-image] Upload successful:', finalUrl);

    return NextResponse.json({
      success: true,
      imageUrl: finalUrl,
      key,
    });

  } catch (error: any) {
    console.error('[fusion/upload-image] Error:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

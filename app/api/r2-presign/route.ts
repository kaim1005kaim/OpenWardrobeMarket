// app/api/r2-presign/route.ts
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { createClient } from '@supabase/supabase-js';
import https from "https";
import dns from "dns";

// Configure DNS to prefer IPv4
dns.setDefaultResultOrder('ipv4first');

// TEMPORARY FIX: Disable SSL certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const s3 = new S3Client({
  endpoint: process.env.R2_S3_ENDPOINT!,
  region: "auto",
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
  tls: false,
});

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // v2.0 TEMPORARY: Allow anonymous access for FUSION migration
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
      console.log('[r2-presign] Anonymous user request');
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const contentType = searchParams.get("contentType") ?? "image/jpeg";

    if (!key) {
      return NextResponse.json({ error: "missing key" }, { status: 400 });
    }

    console.log('[r2-presign] Generating presigned URL for:', key);

    const cmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 }); // 1 hour

    console.log('[r2-presign] Presigned URL generated successfully');
    console.log('[r2-presign] Upload URL:', uploadUrl);

    return NextResponse.json({
      success: true,
      uploadUrl,
      url: uploadUrl, // backward compatibility for clients expecting `url`
      key,
    });

  } catch (e: any) {
    console.error('[r2-presign] Error:', e);
    return NextResponse.json(
      { error: 'Failed to create presigned URL', details: e.message },
      { status: 500 }
    );
  }
}

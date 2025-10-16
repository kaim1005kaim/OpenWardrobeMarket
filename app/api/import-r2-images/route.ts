export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';

const r2Client = new S3Client({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true,
});

export async function POST(request: Request) {
  try {
    console.log('[Import R2] Starting import...');

    // List all objects in usergen folder
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: 'usergen/',
    });

    const response = await r2Client.send(listCommand);
    const objects = response.Contents || [];

    console.log(`[Import R2] Found ${objects.length} objects in R2`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    for (const obj of objects) {
      if (!obj.Key) continue;

      // Extract user_id from path: usergen/{user_id}/...
      const parts = obj.Key.split('/');
      if (parts.length < 2) {
        console.log(`[Import R2] Skipping invalid path: ${obj.Key}`);
        skipped++;
        continue;
      }

      const userId = parts[1];
      const r2Url = `https://pub-4215f2149d4e4f369c2bde9f2769dfd4.r2.dev/${obj.Key}`;

      // Check if already exists
      const { data: existing } = await supabase
        .from('images')
        .select('id')
        .eq('r2_key', obj.Key)
        .single();

      if (existing) {
        console.log(`[Import R2] Already exists: ${obj.Key}`);
        skipped++;
        continue;
      }

      // Extract filename for title
      const filename = parts[parts.length - 1];
      const title = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ');

      try {
        const { data, error } = await supabase.from('images').insert({
          user_id: userId,
          r2_url: r2Url,
          r2_key: obj.Key,
          title: title || 'Generated Design',
          description: 'Imported from R2',
          width: 1024,
          height: 1536,
          mime_type: 'image/png',
          tags: [],
          colors: [],
          is_public: false, // Import as drafts by default
        }).select().single();

        if (error) {
          console.error(`[Import R2] Error importing ${obj.Key}:`, error.message);
          errors++;
          results.push({ key: obj.Key, status: 'error', error: error.message });
        } else {
          console.log(`[Import R2] Imported: ${obj.Key} -> ${data.id}`);
          imported++;
          results.push({ key: obj.Key, status: 'imported', id: data.id });
        }
      } catch (err: any) {
        console.error(`[Import R2] Failed to import ${obj.Key}:`, err);
        errors++;
        results.push({ key: obj.Key, status: 'error', error: err?.message });
      }
    }

    console.log('[Import R2] Import complete!');
    console.log(`[Import R2] Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`);

    return Response.json({
      success: true,
      summary: {
        total: objects.length,
        imported,
        skipped,
        errors
      },
      results: results.slice(0, 100) // Limit response size
    });

  } catch (error: any) {
    console.error('[Import R2] Error:', error);
    return Response.json(
      {
        error: 'Import failed',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

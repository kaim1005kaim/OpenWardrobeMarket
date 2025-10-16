// Import existing R2 images into images table
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Config check:');
console.log('- SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
console.log('- R2_ACCOUNT_ID:', R2_ACCOUNT_ID ? '✓' : '✗');
console.log('- R2_BUCKET:', R2_BUCKET);

// Use same configuration as working API routes
const r2Client = new S3Client({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importExistingImages() {
  console.log('Fetching images from R2...');

  // List all objects in usergen folder
  const listCommand = new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    Prefix: 'usergen/',
  });

  const response = await r2Client.send(listCommand);
  const objects = response.Contents || [];

  console.log(`Found ${objects.length} objects in R2`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const obj of objects) {
    if (!obj.Key) continue;

    // Extract user_id from path: usergen/{user_id}/...
    const parts = obj.Key.split('/');
    if (parts.length < 2) {
      console.log(`Skipping invalid path: ${obj.Key}`);
      skipped++;
      continue;
    }

    const userId = parts[1];
    const r2Url = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${obj.Key}`;

    // Check if already exists
    const { data: existing } = await supabase
      .from('images')
      .select('id')
      .eq('r2_key', obj.Key)
      .single();

    if (existing) {
      console.log(`Already exists: ${obj.Key}`);
      skipped++;
      continue;
    }

    // Extract filename for title
    const filename = parts[parts.length - 1];
    const title = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ');

    try {
      const { error } = await supabase.from('images').insert({
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
        price: 0,
        is_public: false, // Import as drafts by default
      });

      if (error) {
        console.error(`Error importing ${obj.Key}:`, error.message);
        errors++;
      } else {
        console.log(`Imported: ${obj.Key}`);
        imported++;
      }
    } catch (err) {
      console.error(`Failed to import ${obj.Key}:`, err);
      errors++;
    }
  }

  console.log('\nImport complete!');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

importExistingImages().catch(console.error);

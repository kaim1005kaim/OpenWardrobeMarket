/**
 * Generate CLIP embeddings for catalog items in published_items table
 *
 * This script:
 * 1. Fetches catalog items from published_items (category='catalog')
 * 2. Downloads images from R2
 * 3. Generates CLIP embeddings via local CLIP server
 * 4. Updates published_items with embeddings
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ENDPOINT = process.env.R2_S3_ENDPOINT!;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';
const CLIP_SERVER_URL = process.env.CLIP_SERVER_URL || 'http://localhost:5001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!R2_ACCESS_KEY) console.error('Missing R2_ACCESS_KEY_ID');
if (!R2_SECRET_KEY) console.error('Missing R2_SECRET_ACCESS_KEY');
if (!R2_ENDPOINT) console.error('Missing R2_S3_ENDPOINT');
if (!SUPABASE_URL) console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) console.error('Missing SUPABASE_SERVICE_ROLE_KEY');

if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ENDPOINT || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateEmbedding(imageBuffer: Buffer): Promise<number[] | null> {
  try {
    const axios = (await import('axios')).default;
    const FormData = (await import('form-data')).default;

    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'image.png', contentType: 'image/png' });

    const response = await axios.post(`${CLIP_SERVER_URL}/embed`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000,
    });

    const result = response.data;
    const embedding = result.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error('[embed] Invalid embedding format:', result);
      return null;
    }

    return embedding;
  } catch (error: any) {
    console.error('[embed] Error:', error.message);
    return null;
  }
}

async function downloadImageFromR2(key: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks: Uint8Array[] = [];

    if (!response.Body) {
      console.error(`[R2] No body in response for ${key}`);
      return null;
    }

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error: any) {
    console.error(`[R2] Error downloading ${key}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('[catalog-embeddings] Starting embedding generation for catalog items...');
  console.log('[catalog-embeddings] CLIP server:', CLIP_SERVER_URL);

  // Fetch catalog items without embeddings
  const { data: catalogItems, error } = await supabase
    .from('published_items')
    .select('id, image_id, title')
    .eq('category', 'catalog')
    .is('embedding', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[catalog-embeddings] Error fetching catalog items:', error);
    process.exit(1);
  }

  if (!catalogItems || catalogItems.length === 0) {
    console.log('[catalog-embeddings] No catalog items found without embeddings');
    return;
  }

  console.log(`[catalog-embeddings] Found ${catalogItems.length} catalog items without embeddings`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of catalogItems) {
    processed++;
    const imageKey = item.image_id;

    if (processed % 10 === 0) {
      console.log(`[catalog-embeddings] Progress: ${processed}/${catalogItems.length} (✓${succeeded} ✗${failed})`);
    }

    console.log(`[catalog-embeddings] [${processed}/${catalogItems.length}] Processing ${imageKey}...`);

    // Download image from R2
    const imageBuffer = await downloadImageFromR2(imageKey);
    if (!imageBuffer) {
      console.error(`[catalog-embeddings] Failed to download ${imageKey}`);
      failed++;
      continue;
    }

    // Generate embedding
    const embedding = await generateEmbedding(imageBuffer);
    if (!embedding) {
      console.error(`[catalog-embeddings] Failed to generate embedding for ${imageKey}`);
      failed++;
      continue;
    }

    // Update published_items with embedding
    const { error: updateError } = await supabase
      .from('published_items')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', item.id);

    if (updateError) {
      console.error(`[catalog-embeddings] Error updating ${imageKey}:`, updateError.message);
      failed++;
      continue;
    }

    console.log(`[catalog-embeddings] ✓ Generated embedding for ${imageKey} (${embedding.length}D)`);
    succeeded++;

    // Small delay to avoid overwhelming the CLIP server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('[catalog-embeddings] Complete!');
  console.log(`  Processed: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
}

main().catch(console.error);

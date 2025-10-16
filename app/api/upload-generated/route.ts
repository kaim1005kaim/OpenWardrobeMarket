export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!
  }
});

function generateImageTitle(prompt: string, index: number): string {
  const words = prompt
    .toLowerCase()
    .replace(/--\w+\s+[\w\s,]+/g, '')
    .split(' ')
    .filter((word) => word.length > 3)
    .slice(0, 4);

  const baseTitle = words.join(' ').replace(/[^a-z0-9\s]/gi, '');
  const title = `${baseTitle} #${index + 1}`.trim();
  return title || `Generated Design #${index + 1}`;
}

function extractTagsFromPrompt(prompt: string): string[] {
  const keywords = [
    'minimal', 'street', 'luxury', 'casual', 'elegant', 'sophisticated',
    'avant-garde', 'retro', 'vintage', 'modern', 'classic', 'edgy',
    'oversized', 'tailored', 'flowing', 'structured', 'cropped',
    'monochrome', 'colorful', 'neutral', 'bold', 'pastel'
  ];

  return keywords
    .filter((keyword) => prompt.toLowerCase().includes(keyword))
    .slice(0, 8);
}

function extractColorsFromParams(parameters: any): string[] {
  const colors: string[] = [];

  if (parameters?.palette) {
    switch (parameters.palette.toLowerCase()) {
      case 'monochrome':
        colors.push('black', 'white', 'gray');
        break;
      case 'neutral':
        colors.push('beige', 'cream', 'taupe');
        break;
      case 'earth':
        colors.push('brown', 'tan', 'olive');
        break;
      case 'neon':
        colors.push('electric blue', 'hot pink', 'lime green');
        break;
      default:
        colors.push(parameters.palette);
    }
  }

  return colors.slice(0, 5);
}

async function updateUserStats(userId: string, imageCount: number) {
  try {
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('total_items')
      .eq('id', userId)
      .maybeSingle();

    const totalItems = (existing?.total_items || 0) + imageCount;

    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          total_items: totalItems,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('[Upload] User stats update error:', error);
    }
  } catch (error) {
    console.error('[Upload] User stats update failed:', error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json(
      { error: 'Invalid JSON body', required: ['user_id', 'images', 'generation_data'] },
      { status: 400 }
    );
  }

  const { user_id, images, generation_data } = body;

  if (!user_id || !images || !generation_data) {
    return Response.json(
      { error: 'Missing required fields', required: ['user_id', 'images', 'generation_data'] },
      { status: 400 }
    );
  }

  try {
    console.log('[Upload] Processing generated images:', {
      user_id,
      image_count: images.length,
      prompt: generation_data.prompt?.slice(0, 100)
    });

    const { data: historyData, error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id,
        prompt: generation_data.prompt,
        generation_data: {
          session_id: generation_data.session_id || `gen-${Date.now()}`,
          parameters: generation_data.parameters || {},
          result_images: images.map((img: any) => img.url),
        },
        completion_status: 'completed'
      })
      .select()
      .single();

    if (historyError) {
      console.error('[Upload] History insert error:', historyError);
      throw historyError;
    }

    const savedImages: any[] = [];

    for (const [index, image] of images.entries()) {
      try {
        const imageResponse = await fetch(image.url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        const timestamp = new Date().toISOString().slice(0, 10);
        const imageId = `gen-${historyData.id}-${index}`;
        const extension = contentType.includes('png') ? 'png' : 'jpg';
        const r2Key = `generated/${user_id}/${timestamp}/${imageId}.${extension}`;

        const uploadCommand = new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: new Uint8Array(imageBuffer),
          ContentType: contentType,
          Metadata: {
            'user-id': user_id,
            'generation-id': historyData.id,
            prompt: generation_data.prompt?.slice(0, 500) || '',
            'original-url': image.url
          }
        });

        await r2Client.send(uploadCommand);

        const r2PublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${r2Key}`;
        const tags = extractTagsFromPrompt(generation_data.prompt || '');
        const colors = extractColorsFromParams(generation_data.parameters);

        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            title: generateImageTitle(generation_data.prompt || '', index),
            r2_url: r2PublicUrl,
            r2_key: r2Key,
            user_id,
            type: 'generated',
            tags,
            colors,
            width: 1024,
            height: 1536,
            is_public: true,
            generation_params: generation_data.parameters,
            original_prompt: generation_data.prompt,
            aspect_ratio: '2:3'
          })
          .select()
          .single();

        if (imageError) {
          console.error('[Upload] Image insert error:', imageError);
          throw imageError;
        }

        savedImages.push({
          id: imageData.id,
          url: r2PublicUrl,
          title: imageData.title,
          tags: imageData.tags,
          colors: imageData.colors,
          original_url: image.url
        });

        console.log('[Upload] Saved image:', {
          id: imageData.id,
          r2Key,
          title: imageData.title
        });
      } catch (error) {
        console.error(`[Upload] Error processing image ${index}:`, error);
        continue;
      }
    }

    await updateUserStats(user_id, savedImages.length);

    return Response.json({
      success: true,
      generation_id: historyData.id,
      images: savedImages,
      message: `${savedImages.length} images saved successfully`
    });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return Response.json(
      {
        error: 'Upload failed',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

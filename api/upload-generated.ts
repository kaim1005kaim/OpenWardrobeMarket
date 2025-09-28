import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../src/app/lib/supabase';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

interface UploadRequest {
  user_id: string;
  images: Array<{
    url: string;
    id: string;
    index?: number;
  }>;
  generation_data: {
    prompt: string;
    parameters: any;
    session_id?: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, images, generation_data }: UploadRequest = req.body;

  if (!user_id || !images || !generation_data) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['user_id', 'images', 'generation_data']
    });
  }

  try {
    console.log('[Upload] Processing generated images:', {
      user_id,
      image_count: images.length,
      prompt: generation_data.prompt.slice(0, 100)
    });

    // Record generation in history first
    const { data: historyData, error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id,
        session_id: generation_data.session_id || `gen-${Date.now()}`,
        prompt: generation_data.prompt,
        parameters: generation_data.parameters || {},
        result_images: images.map(img => img.url),
        status: 'completed'
      })
      .select()
      .single();

    if (historyError) {
      console.error('[Upload] History insert error:', historyError);
      throw historyError;
    }

    const savedImages = [];

    // Process each generated image
    for (const [index, image] of images.entries()) {
      try {
        // Download image from external URL
        const imageResponse = await fetch(image.url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        
        // Generate R2 key
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const imageId = `gen-${historyData.id}-${index}`;
        const extension = contentType.includes('png') ? 'png' : 'jpg';
        const r2Key = `generated/${user_id}/${timestamp}/${imageId}.${extension}`;

        // Upload to R2
        const uploadCommand = new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: new Uint8Array(imageBuffer),
          ContentType: contentType,
          Metadata: {
            'user-id': user_id,
            'generation-id': historyData.id,
            'prompt': generation_data.prompt.slice(0, 500),
            'original-url': image.url
          }
        });

        await r2Client.send(uploadCommand);

        // Construct public R2 URL
        const r2PublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${r2Key}`;

        // Extract metadata from generation parameters
        const tags = extractTagsFromPrompt(generation_data.prompt);
        const colors = extractColorsFromParams(generation_data.parameters);
        
        // Save to images table
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .insert({
            title: generateImageTitle(generation_data.prompt, index),
            r2_url: r2PublicUrl,
            r2_key: r2Key,
            user_id,
            type: 'generated',
            tags,
            colors,
            width: 1024, // Default Midjourney size
            height: 1536, // 2:3 aspect ratio
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
        // Continue with other images instead of failing completely
        continue;
      }
    }

    // Update user profile stats
    await updateUserStats(user_id, savedImages.length);

    res.status(200).json({
      success: true,
      generation_id: historyData.id,
      images: savedImages,
      message: `${savedImages.length} images saved successfully`
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateImageTitle(prompt: string, index: number): string {
  // Extract key words from prompt for title
  const words = prompt
    .toLowerCase()
    .replace(/--\w+\s+[\w\s,]+/g, '') // Remove Midjourney parameters
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 4);
  
  const baseTitle = words.join(' ').replace(/[^a-z0-9\s]/gi, '');
  return `${baseTitle} #${index + 1}`.trim() || `Generated Design #${index + 1}`;
}

function extractTagsFromPrompt(prompt: string): string[] {
  const keywords = [
    'minimal', 'street', 'luxury', 'casual', 'elegant', 'sophisticated',
    'avant-garde', 'retro', 'vintage', 'modern', 'classic', 'edgy',
    'oversized', 'tailored', 'flowing', 'structured', 'cropped',
    'monochrome', 'colorful', 'neutral', 'bold', 'pastel'
  ];

  return keywords.filter(keyword => 
    prompt.toLowerCase().includes(keyword)
  ).slice(0, 8);
}

function extractColorsFromParams(parameters: any): string[] {
  const colors = [];
  
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
    // Upsert user profile with updated stats
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        total_items: supabase.rpc('increment_user_items', { 
          user_id: userId, 
          count: imageCount 
        })
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('[Upload] User stats update error:', error);
    }
  } catch (error) {
    console.error('[Upload] User stats update failed:', error);
  }
}
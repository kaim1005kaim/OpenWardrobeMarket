export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import archiver from 'archiver';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    item_id,
    user_id,
    format = 'png',
    quality = 'high',
    include_metadata = true,
    batch_ids = []
  } = body;

  if (!user_id) {
    return Response.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    if (item_id) {
      const result = await exportSingleItem(item_id, user_id, format, quality, include_metadata);
      if (result.error) {
        return Response.json({ error: result.error }, { status: result.status || 500 });
      }
      return Response.json(result);
    }

    if (batch_ids && batch_ids.length > 0) {
      const result = await exportBatchItems(batch_ids, user_id, format, quality, include_metadata);
      if (result.error) {
        return Response.json({ error: result.error }, { status: result.status || 500 });
      }
      return Response.json(result);
    }

    return Response.json({ error: 'Either item_id or batch_ids is required' }, { status: 400 });
  } catch (error: any) {
    console.error('[Export API] Error:', error);
    return Response.json(
      {
        error: 'Failed to export',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function exportSingleItem(
  itemId: string,
  userId: string,
  format: string,
  quality: string,
  includeMetadata: boolean
) {
  try {
    let item: any = null;
    let source = '';

    const { data: genItem } = await supabase
      .from('generation_history')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (genItem) {
      item = genItem;
      source = 'generation_history';
    } else {
      const { data: pubItem } = await supabase
        .from('published_items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

      if (pubItem) {
        item = pubItem;
        source = 'published_items';
      }
    }

    if (!item) {
      return { error: 'Item not found or access denied', status: 404 };
    }

    const imageUrl = item.r2_url || item.image_url || item.images?.[0]?.url;
    if (!imageUrl) {
      return { error: 'No image found for this item', status: 404 };
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { error: 'Failed to fetch image', status: 500 };
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    let processedImage = imageBuffer;
    let dimensions = { width: 0, height: 0 };

    if (format !== 'original') {
      const sharpInstance = sharp(imageBuffer);
      const metadata = await sharpInstance.metadata();

      switch (quality) {
        case 'ultra':
          dimensions = { width: 3000, height: 4500 };
          break;
        case 'high':
          dimensions = { width: 2048, height: 3072 };
          break;
        case 'medium':
          dimensions = { width: 1280, height: 1920 };
          break;
        case 'low':
          dimensions = { width: 720, height: 1080 };
          break;
        default:
          dimensions = { width: metadata.width || 1024, height: metadata.height || 1536 };
      }

      let pipeline = sharpInstance.resize({
        width: dimensions.width,
        height: dimensions.height,
        fit: 'cover'
      });

      switch (format) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({
            quality: quality === 'ultra' ? 100 : quality === 'high' ? 95 : 85
          });
          break;
        case 'webp':
          pipeline = pipeline.webp({
            quality: quality === 'ultra' ? 100 : quality === 'high' ? 95 : 85
          });
          break;
        case 'png':
        default:
          pipeline = pipeline.png({
            compressionLevel: quality === 'low' ? 9 : 6
          });
          break;
      }

      processedImage = await pipeline.toBuffer();
    }

    const exportData: any = {
      success: true,
      item_id: itemId,
      filename: `owm-${itemId}-${quality}.${format}`,
      format,
      quality,
      dimensions,
      size: processedImage.length,
      download_url: `data:image/${format};base64,${processedImage.toString('base64')}`
    };

    if (includeMetadata) {
      exportData.metadata = {
        title: item.title || item.generation_data?.title || 'Design',
        created_at: item.created_at,
        tags: item.tags || item.generation_data?.parameters?.tags || [],
        colors: item.colors || item.generation_data?.parameters?.colors || [],
        prompt: item.prompt || item.original_prompt || '',
        parameters: item.generation_data?.parameters || {},
        source
      };
    }

    return exportData;
  } catch (error) {
    console.error('Export single item error:', error);
    return { error: 'Failed to export item', status: 500 };
  }
}

async function exportBatchItems(
  batchIds: string[],
  userId: string,
  format: string,
  quality: string,
  includeMetadata: boolean
) {
  try {
    if (batchIds.length > 10) {
      return { error: 'Maximum 10 items can be exported at once', status: 400 };
    }

    const exportPromises = batchIds.map((id) =>
      exportSingleItem(id, userId, format, quality, false)
    );

    const results = await Promise.all(exportPromises);
    const successfulExports = results.filter((r) => r.success);

    if (successfulExports.length === 0) {
      return { error: 'No items could be exported', status: 500 };
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const chunks: Buffer[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));

    for (const exp of successfulExports) {
      const base64Data = exp.download_url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      archive.append(buffer, { name: exp.filename });
    }

    if (includeMetadata) {
      const metadata = {
        export_date: new Date().toISOString(),
        total_items: successfulExports.length,
        items: successfulExports.map((exp) => ({
          item_id: exp.item_id,
          filename: exp.filename,
          format: exp.format,
          quality: exp.quality,
          dimensions: exp.dimensions
        }))
      };
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    return {
      success: true,
      type: 'batch',
      total_items: successfulExports.length,
      filename: `owm-batch-${Date.now()}.zip`,
      size: zipBuffer.length,
      download_url: `data:application/zip;base64,${zipBuffer.toString('base64')}`
    };
  } catch (error) {
    console.error('Export batch error:', error);
    return { error: 'Failed to export batch', status: 500 };
  }
}

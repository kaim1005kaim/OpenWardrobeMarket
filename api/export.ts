import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import archiver from 'archiver';
// import { Readable } from 'stream';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    item_id, 
    user_id,
    format = 'png',
    quality = 'high',
    include_metadata = true,
    batch_ids = []
  } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Single item export
    if (item_id) {
      const result = await exportSingleItem(item_id, user_id, format, quality, include_metadata);
      if (result.error) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      return res.status(200).json(result);
    }

    // Batch export
    if (batch_ids && batch_ids.length > 0) {
      const result = await exportBatchItems(batch_ids, user_id, format, quality, include_metadata);
      if (result.error) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Either item_id or batch_ids is required' });

  } catch (error) {
    console.error('[Export API] Error:', error);
    res.status(500).json({
      error: 'Failed to export',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
    // Get item from generation_history or published_items
    let item: any = null;
    let source = '';

    // Check generation_history first
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
      // Check published_items
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

    // Get image URL
    const imageUrl = item.r2_url || item.image_url || item.images?.[0]?.url;
    if (!imageUrl) {
      return { error: 'No image found for this item', status: 404 };
    }

    // Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { error: 'Failed to fetch image', status: 500 };
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Process image based on quality settings
    let processedImage = imageBuffer;
    let dimensions = { width: 0, height: 0 };

    if (format !== 'original') {
      const sharpInstance = sharp(imageBuffer);
      const metadata = await sharpInstance.metadata();
      
      // Set quality and dimensions based on quality setting
      switch (quality) {
        case 'ultra':
          dimensions = { width: 3000, height: 4500 };
          break;
        case 'high':
          dimensions = { width: 2000, height: 3000 };
          break;
        case 'medium':
          dimensions = { width: 1200, height: 1800 };
          break;
        case 'low':
          dimensions = { width: 800, height: 1200 };
          break;
        default:
          dimensions = { width: metadata.width || 2000, height: metadata.height || 3000 };
      }

      // Resize and format conversion
      let pipeline = sharpInstance.resize(dimensions.width, dimensions.height, {
        fit: 'inside',
        withoutEnlargement: true
      });

      // Apply format
      switch (format) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ quality: quality === 'ultra' ? 100 : quality === 'high' ? 95 : 85 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: quality === 'ultra' ? 100 : quality === 'high' ? 95 : 85 });
          break;
        case 'png':
        default:
          pipeline = pipeline.png({ compressionLevel: quality === 'low' ? 9 : 6 });
          break;
      }

      const buffer = await pipeline.toBuffer();
      processedImage = Buffer.from(buffer);
    }

    // Prepare response data
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

    // Add metadata if requested
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

    const exportPromises = batchIds.map(id => 
      exportSingleItem(id, userId, format, quality, false)
    );

    const results = await Promise.all(exportPromises);
    
    // Filter successful exports
    const successfulExports = results.filter(r => r.success);
    
    if (successfulExports.length === 0) {
      return { error: 'No items could be exported', status: 500 };
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const chunks: Buffer[] = [];
    archive.on('data', chunk => chunks.push(chunk));

    // Add each image to archive
    for (const exp of successfulExports) {
      const base64Data = exp.download_url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      archive.append(buffer, { name: exp.filename });
    }

    // Add metadata JSON if requested
    if (includeMetadata) {
      const metadata = {
        export_date: new Date().toISOString(),
        total_items: successfulExports.length,
        items: successfulExports.map(exp => ({
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
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    console.log('[publish] Request body:', body);

    const { image_url, title, description, tags, colors, category, price } = body;

    if (!image_url) {
      console.error('[publish] Missing image_url in request body');
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    // Extract key from image_url to find images record
    const urlParts = image_url.split('/');
    const filename = urlParts[urlParts.length - 1];
    const folderPath = urlParts.slice(3).slice(0, -1).join('/');
    const full_path = `${folderPath}/${filename}`;

    console.log('[publish] Looking for image with URL:', image_url);

    // Find the images record first (more reliable than generation_history)
    const { data: imageRecords, error: imageQueryError } = await supabase
      .from('images')
      .select('*')
      .eq('user_id', user.id)
      .eq('r2_url', image_url)
      .limit(1);

    if (imageQueryError) {
      console.error('[publish] Error fetching images:', imageQueryError);
      return NextResponse.json({ error: 'Failed to find image record' }, { status: 500 });
    }

    let existingImageRecord = imageRecords && imageRecords.length > 0 ? imageRecords[0] : null;

    if (!existingImageRecord) {
      console.log('[publish] No existing image found, will create new one');
    } else {
      console.log('[publish] Found existing image:', existingImageRecord.id);
    }

    // Use existing image or create new one
    let imageRecord = existingImageRecord;

    if (!imageRecord) {
      // Create new image record if it doesn't exist
      const { data: newImageRecord, error: imageError } = await supabase
        .from('images')
        .insert({
          user_id: user.id,
          r2_url: image_url,
          r2_key: full_path,
          title: title || 'Untitled Design',
          description: description || '',
          width: 1024,
          height: 1024,
          mime_type: 'image/png',
          tags: tags || [],
          colors: colors || [],
          price: price || 0,
          is_public: true
        })
        .select()
        .single();

      if (imageError) {
        console.error('[publish] Error creating image record:', imageError);
        return NextResponse.json({ error: 'Failed to create image record: ' + imageError.message }, { status: 500 });
      }

      imageRecord = newImageRecord;
      console.log('[publish] Created new image record:', imageRecord.id);
    } else {
      // Update existing image to be public
      const { error: updateError } = await supabase
        .from('images')
        .update({
          is_public: true,
          title: title || imageRecord.title,
          description: description || imageRecord.description,
          price: price || imageRecord.price
        })
        .eq('id', imageRecord.id);

      if (updateError) {
        console.error('[publish] Error updating image:', updateError);
        // Continue anyway
      } else {
        console.log('[publish] Updated existing image to public');
      }
    }

    // Create published_items record
    const { data: publishedItem, error: publishError } = await supabase
      .from('published_items')
      .insert({
        user_id: user.id,
        image_id: imageRecord.id,
        title: title || 'Untitled Design',
        description: description || '',
        price: price || 0,
        tags: tags || [],
        colors: colors || [],
        category: category || 'clothing',
        is_active: true,
        original_url: image_url,
        poster_url: image_url, // Use same image for now
        sale_type: 'buyout'
      })
      .select()
      .single();

    if (publishError) {
      console.error('[publish] Error creating published_item:', publishError);
      return NextResponse.json({ error: 'Failed to publish item: ' + publishError.message }, { status: 500 });
    }

    console.log('[publish] Successfully published item:', publishedItem);

    return NextResponse.json({
      success: true,
      item: publishedItem,
      history_id: historyRecord.id
    });

  } catch (error) {
    console.error('[publish] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

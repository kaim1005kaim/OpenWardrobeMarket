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

    // Extract key from image_url to find generation_history record
    // URL format: https://assets.open-wardrobe-market.com/usergen/.../filename.png
    const urlParts = image_url.split('/');
    const filename = urlParts[urlParts.length - 1];
    const folderPath = urlParts.slice(3).slice(0, -1).join('/'); // Remove domain and filename
    const full_path = `${folderPath}/${filename}`;

    console.log('[publish] Looking for generation_history with path:', full_path);

    // Find the generation_history record
    const { data: historyRecords, error: historyError } = await supabase
      .from('generation_history')
      .select('id, user_id, image_url, image_path')
      .eq('user_id', user.id)
      .or(`image_url.eq.${image_url},image_path.eq.${full_path}`)
      .limit(1);

    if (historyError) {
      console.error('[publish] Error fetching generation_history:', historyError);
      return NextResponse.json({ error: 'Failed to find image record' }, { status: 500 });
    }

    if (!historyRecords || historyRecords.length === 0) {
      console.error('[publish] No generation_history found for:', { image_url, full_path, user_id: user.id });
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const historyRecord = historyRecords[0];
    console.log('[publish] Found generation_history:', historyRecord);

    // Create images table record first
    const { data: imageRecord, error: imageError } = await supabase
      .from('images')
      .insert({
        user_id: user.id,
        r2_url: image_url,
        r2_key: full_path,
        title: title || 'Untitled Design',
        description: description || '',
        width: 1024, // Default for generated images
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

    console.log('[publish] Created image record:', imageRecord);

    // Update generation_history to mark as public
    const { error: updateError } = await supabase
      .from('generation_history')
      .update({
        is_public: true,
        published_at: new Date().toISOString()
      })
      .eq('id', historyRecord.id);

    if (updateError) {
      console.error('[publish] Error updating generation_history:', updateError);
      // Don't fail the whole operation if this update fails
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

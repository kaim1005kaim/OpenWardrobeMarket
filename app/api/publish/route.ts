export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evolveProfile } from '../../../src/lib/urula/evolution';
import type { UserUrulaProfile, EvolutionInput } from '../../../src/types/urula';

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

    const { image_url, r2_key, title, description, tags, colors, category, price, generation_data } = body;

    if (!image_url) {
      console.error('[publish] Missing image_url in request body');
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    // Use provided r2_key or extract from URL
    let full_path = r2_key;
    if (!full_path) {
      const urlParts = image_url.split('/');
      const filename = urlParts[urlParts.length - 1];
      const folderPath = urlParts.slice(3).slice(0, -1).join('/');
      full_path = `${folderPath}/${filename}`;
    }

    console.log('[publish] Looking for image with URL:', image_url);
    console.log('[publish] R2 key:', full_path);

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

    // Check if published_items already exists for this image
    const { data: existingPublished } = await supabase
      .from('published_items')
      .select('id, is_active')
      .eq('image_id', imageRecord.id)
      .single();

    let publishedItem;

    if (existingPublished) {
      // Update existing published_items if it was deactivated
      if (!existingPublished.is_active) {
        const { data: updatedItem, error: updateError } = await supabase
          .from('published_items')
          .update({
            is_active: true,
            title: title || 'Untitled Design',
            description: description || '',
            price: price || 0,
            tags: tags || [],
            colors: colors || [],
            category: category || 'clothing',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPublished.id)
          .select()
          .single();

        if (updateError) {
          console.error('[publish] Error updating published_item:', updateError);
          return NextResponse.json({ error: 'Failed to update published item: ' + updateError.message }, { status: 500 });
        }

        publishedItem = updatedItem;
        console.log('[publish] Reactivated existing published_item:', publishedItem.id);
      } else {
        // Already published and active
        console.log('[publish] Image already published:', existingPublished.id);
        publishedItem = existingPublished;
      }
    } else {
      // Create new published_items record
      const { data: newItem, error: publishError } = await supabase
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
          poster_url: image_url,
          sale_type: 'buyout'
        })
        .select()
        .single();

      if (publishError) {
        console.error('[publish] Error creating published_item:', publishError);
        return NextResponse.json({ error: 'Failed to publish item: ' + publishError.message }, { status: 500 });
      }

      publishedItem = newItem;
      console.log('[publish] Successfully created published_item:', publishedItem.id);
    }

    // Optionally save generation_data if provided
    if (generation_data) {
      const { error: historyError } = await supabase
        .from('generation_history')
        .insert({
          user_id: user.id,
          prompt: generation_data.prompt || '',
          generation_data: {
            session_id: generation_data.session_id || `gen-${Date.now()}`,
            parameters: generation_data.parameters || {},
            result_images: [image_url]
          },
          completion_status: 'completed'
        });

      if (historyError) {
        console.warn('[publish] Failed to save generation history:', historyError.message);
        // Continue anyway - this is optional
      }
    }

    // Evolve Urula profile after publish (strong signal)
    try {
      const { data: profileData } = await supabase
        .from('user_urula_profile')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        const styleTags = tags || [];
        const colorList = colors || [];
        const colorHSL = colorList.map((colorName: string) => {
          const hslMap: Record<string, { h: number; s: number; l: number }> = {
            'black': { h: 0, s: 0, l: 0 },
            'white': { h: 0, s: 0, l: 1 },
            'red': { h: 0, s: 0.8, l: 0.5 },
            'blue': { h: 240, s: 0.8, l: 0.5 },
            'green': { h: 120, s: 0.8, l: 0.4 },
            'yellow': { h: 60, s: 0.9, l: 0.5 },
            'orange': { h: 30, s: 0.9, l: 0.5 },
            'purple': { h: 280, s: 0.7, l: 0.5 },
            'pink': { h: 330, s: 0.7, l: 0.7 },
            'gray': { h: 0, s: 0, l: 0.5 },
          };
          return { name: colorName, ...(hslMap[colorName.toLowerCase()] || { h: 160, s: 0.25, l: 0.75 }) };
        });

        const evolutionInput: EvolutionInput = {
          styleTags,
          colors: colorHSL,
          signals: {
            published: true, // Very strong signal (2x multiplier)
          },
        };

        const evolvedProfile = evolveProfile(profileData as UserUrulaProfile, evolutionInput);

        await supabase
          .from('user_urula_profile')
          .update({
            mat_weights: evolvedProfile.mat_weights,
            glass_gene: evolvedProfile.glass_gene,
            chaos: evolvedProfile.chaos,
            tint: evolvedProfile.tint,
            palette: evolvedProfile.palette,
            history: evolvedProfile.history,
            updated_at: evolvedProfile.updated_at,
          })
          .eq('user_id', user.id);

        console.log('[publish] Profile evolved after publish:', evolvedProfile.mat_weights);
      }
    } catch (evolutionError) {
      console.warn('[publish] Failed to evolve profile:', evolutionError);
      // Continue anyway - this is optional
    }

    return NextResponse.json({
      success: true,
      item: publishedItem,
      image_id: imageRecord.id
    });

  } catch (error) {
    console.error('[publish] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

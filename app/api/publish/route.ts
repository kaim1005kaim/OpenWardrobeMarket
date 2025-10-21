export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evolveProfile } from '../../../src/lib/urula/evolution';
import { convertColorNamesToHSL } from '../../../src/lib/urula/colorMapping';
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
    // Try to find by R2 key first, then by UUID for backwards compatibility
    const r2KeyToFind = imageRecord.r2_key || `usergen/${imageRecord.id}.png`;
    let { data: existingPublished } = await supabase
      .from('published_items')
      .select('id, is_active, image_id')
      .eq('image_id', r2KeyToFind)
      .single();

    // Fallback: try to find by old UUID format
    if (!existingPublished) {
      const { data: uuidPublished } = await supabase
        .from('published_items')
        .select('id, is_active, image_id')
        .eq('image_id', imageRecord.id)
        .single();
      existingPublished = uuidPublished;
    }

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
            category: category || 'user-generated',
            image_id: r2KeyToFind, // Ensure image_id is the R2 key path
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
          image_id: imageRecord.r2_key || `usergen/${imageRecord.id}.png`, // Use R2 key path, not UUID
          title: title || 'Untitled Design',
          description: description || '',
          price: price || 0,
          tags: tags || [],
          colors: colors || [],
          category: category || 'user-generated',
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

    // Generate AI analysis (auto_tags, ai_description) and CLIP embedding
    try {
      console.log('[publish] Starting AI analysis for:', image_url);

      // 1. Fetch image as base64 for Gemini Vision
      let autoTags: string[] = [];
      let aiDescription = '';

      try {
        const imageResponse = await fetch(image_url);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        // 2. Gemini Vision analysis
        const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gemini/analyze-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64Image,
            mimeType: 'image/png'
          })
        });

        if (analysisResponse.ok) {
          const { tags, description } = await analysisResponse.json();
          autoTags = tags || [];
          aiDescription = description || '';
          console.log('[publish] Gemini analysis:', { autoTags, aiDescription });
        } else {
          console.warn('[publish] Gemini analysis failed:', await analysisResponse.text());
        }
      } catch (analysisError) {
        console.warn('[publish] Gemini analysis error (non-fatal):', analysisError);
      }

      // 3. CLIP embedding generation
      let embedding = null;
      try {
        const embeddingResponse = await fetch('http://localhost:5001/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: image_url })
        });

        if (embeddingResponse.ok) {
          const result = await embeddingResponse.json();
          embedding = result.embedding;
          console.log('[publish] CLIP embedding generated');
        } else {
          console.warn('[publish] CLIP embedding failed:', await embeddingResponse.text());
        }
      } catch (clipError) {
        console.warn('[publish] CLIP embedding error (non-fatal):', clipError);
      }

      // 4. Update published_items with all AI-generated data
      const updateData: any = {};
      if (autoTags.length > 0) updateData.auto_tags = autoTags;
      if (aiDescription) updateData.ai_description = aiDescription;
      if (embedding) updateData.embedding = embedding;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('published_items')
          .update(updateData)
          .eq('id', publishedItem.id);

        if (updateError) {
          console.error('[publish] Failed to save AI data:', updateError.message);
        } else {
          console.log('[publish] Successfully saved AI analysis and embedding');
        }
      }
    } catch (aiError) {
      console.warn('[publish] AI processing error (non-fatal):', aiError);
      // Continue - AI features are optional, don't fail the publish
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
        const colorHSL = convertColorNamesToHSL(colors || []);

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

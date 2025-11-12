import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PublishRequest {
  title: string;
  category: string;
  description: string;
  tags: string[];
  saleType: 'buyout' | 'subscription';
  price: number;
  posterUrl: string;
  originalUrl: string;
  userId?: string; // Optional for now (will be required with auth)
  sessionId?: string; // Optional: generation_history session_id for fetching variants
}

// POST /api/publish - Publish an item to the gallery
router.post('/', async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      tags,
      saleType,
      price,
      posterUrl,
      originalUrl,
      userId,
      sessionId
    } = req.body as PublishRequest;

    console.log('[Publish API] Publishing item:', { title, category, posterUrl, originalUrl, sessionId });

    // Validate required fields
    if (!title || !category || !posterUrl || !originalUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, category, posterUrl, originalUrl'
      });
    }

    // Fetch variants from generation_history if sessionId provided
    let metadata: any = {};
    if (sessionId) {
      console.log('[Publish API] Fetching variants for session:', sessionId);

      const { data: genHistory, error: genError } = await supabase
        .from('generation_history')
        .select('metadata')
        .eq('id', sessionId)
        .single();

      if (genError) {
        console.error('[Publish API] Failed to fetch generation_history:', genError);
      } else if (genHistory?.metadata?.variants) {
        // Copy variants to published_items metadata
        metadata.variants = genHistory.metadata.variants;
        console.log('[Publish API] Found variants:', metadata.variants.length);
      } else {
        console.log('[Publish API] No variants found in generation_history');
      }
    }

    // Insert into published_items table
    const { data, error } = await supabase
      .from('published_items')
      .insert({
        user_id: userId || null, // Temporary: allow null until auth is implemented
        title,
        description,
        price,
        tags,
        category,
        poster_url: posterUrl,
        original_url: originalUrl,
        sale_type: saleType,
        is_active: true,
        metadata, // Include variants in metadata
      })
      .select()
      .single();

    if (error) {
      console.error('[Publish API] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to publish item',
        details: error.message
      });
    }

    console.log('[Publish API] Item published successfully:', data.id);
    console.log('[Publish API] Metadata saved:', data.metadata);

    res.json({
      success: true,
      item: data
    });
  } catch (error) {
    console.error('[Publish API] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/publish - Get published items for gallery
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    console.log('[Publish API] Fetching published items:', { limit, offset });

    const { data, error } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error('[Publish API] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch published items',
        details: error.message
      });
    }

    res.json({
      success: true,
      items: data,
      count: data.length
    });
  } catch (error) {
    console.error('[Publish API] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

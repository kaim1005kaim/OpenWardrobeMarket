import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { user_id, type = 'all', limit = 50, offset = 0 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    try {
      let data: any[] = [];
      let error: any = null;
      let count = 0;

      if (type === 'generated' || type === 'all') {
        // Get generation history
        const result = await supabase
          .from('generation_history')
          .select('*', { count: 'exact' })
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

        if (result.error) {
          console.error('Error fetching generation history:', result.error);
        } else {
          // Transform generation history to gallery format
          const generatedItems = (result.data || []).map(item => ({
            id: item.id,
            title: item.generation_data?.title || 'Generated Design',
            src: item.images?.[0]?.url || item.r2_url || '',
            r2_url: item.r2_url,
            tags: item.generation_data?.parameters?.tags || [],
            colors: item.generation_data?.parameters?.colors || [],
            width: 800,
            height: 1200,
            likes: 0,
            created_at: item.created_at,
            type: 'generated',
            is_published: false,
            original_prompt: item.prompt,
            generation_params: item.generation_data?.parameters || {},
            images: item.images || []
          }));
          data = [...data, ...generatedItems];
          count += result.count || 0;
        }
      }

      if (type === 'published' || type === 'all') {
        // Get published items
        const result = await supabase
          .from('published_items')
          .select('*', { count: 'exact' })
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

        if (result.error) {
          console.error('Error fetching published items:', result.error);
        } else {
          // Transform published items to gallery format
          const publishedItems = (result.data || []).map(item => ({
            id: item.id,
            title: item.title,
            src: item.image_url || '',
            r2_url: item.image_url,
            tags: item.tags || [],
            colors: item.colors || [],
            width: item.metadata?.width || 800,
            height: item.metadata?.height || 1200,
            likes: item.likes || 0,
            views: item.views || 0,
            created_at: item.created_at,
            type: 'published',
            is_published: true,
            price: item.price,
            status: item.status,
            description: item.description
          }));
          
          // Avoid duplicates if fetching 'all'
          if (type === 'all') {
            publishedItems.forEach(item => {
              if (!data.find(d => d.id === item.id)) {
                data.push(item);
              }
            });
          } else {
            data = publishedItems;
          }
          
          if (type === 'published') {
            count = result.count || 0;
          }
        }
      }

      if (type === 'saved') {
        // Get saved items from collections
        const result = await supabase
          .from('collections')
          .select(`
            *,
            published_items (*)
          `, { count: 'exact' })
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

        if (result.error) {
          console.error('Error fetching saved items:', result.error);
        } else {
          // Transform saved items to gallery format
          const savedItems = (result.data || []).flatMap(collection => 
            (collection.published_items || []).map((item: any) => ({
              id: item.id,
              title: item.title,
              src: item.image_url || '',
              r2_url: item.image_url,
              tags: item.tags || [],
              colors: item.colors || [],
              width: item.metadata?.width || 800,
              height: item.metadata?.height || 1200,
              likes: item.likes || 0,
              created_at: item.created_at,
              type: 'saved',
              saved_at: collection.created_at,
              collection_name: collection.name
            }))
          );
          data = savedItems;
          count = savedItems.length;
        }
      }

      res.status(200).json({
        success: true,
        images: data,
        total: count,
        type
      });

    } catch (error) {
      console.error('Error fetching user gallery:', error);
      res.status(500).json({ 
        error: 'Failed to fetch gallery',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } 
  else if (req.method === 'DELETE') {
    // Delete user's generated image
    const { user_id, image_id } = req.body;
    
    if (!user_id || !image_id) {
      return res.status(400).json({ error: 'user_id and image_id are required' });
    }

    try {
      // Check ownership in generation_history
      const { data: imageData, error: fetchError } = await supabase
        .from('generation_history')
        .select('user_id')
        .eq('id', image_id)
        .single();

      if (fetchError || !imageData) {
        return res.status(404).json({ error: 'Image not found' });
      }

      if (imageData.user_id !== user_id) {
        return res.status(403).json({ error: 'Not authorized to delete this image' });
      }

      // Delete the image
      const { error: deleteError } = await supabase
        .from('generation_history')
        .delete()
        .eq('id', image_id)
        .eq('user_id', user_id);

      if (deleteError) throw deleteError;

      res.status(200).json({ success: true });

    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ 
        error: 'Failed to delete image',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
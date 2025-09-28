import { createClient } from '@supabase/supabase-js';

// Environment variables for both development and production
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
  throw new Error('Supabase configuration is missing. Please check environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// Database types
export interface GeneratedImage {
  id: string;
  user_id?: string; // For future user authentication
  title: string;
  prompt: string;
  tags: string[];
  colors?: string[];
  r2_key: string; // Path to image in R2
  r2_url: string; // Public URL
  is_public: boolean;
  likes: number;
  width?: number;
  height?: number;
  aspect_ratio?: string;
  blur_data_url?: string;
  dominant_color?: string;
  created_at: string;
  updated_at: string;
}

export interface UserGallery {
  id: string;
  user_id: string;
  image_id: string;
  created_at: string;
}
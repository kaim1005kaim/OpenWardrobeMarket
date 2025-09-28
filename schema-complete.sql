-- OpenWardrobeMarket Complete Database Schema
-- This extends the existing schema with full marketplace functionality

-- Create published_items table for marketplace listings
CREATE TABLE IF NOT EXISTS published_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 1000 AND price <= 1000000),
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed')),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles table for additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  website VARCHAR(200),
  location VARCHAR(100),
  total_sales INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User generation history for tracking AI creations
CREATE TABLE IF NOT EXISTS generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id VARCHAR(100),
  prompt TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  result_images TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Collections for organizing saved items
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  cover_image_id UUID REFERENCES images(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Collection items junction table
CREATE TABLE IF NOT EXISTS collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collection_id, image_id)
);

-- Add missing columns to images table
ALTER TABLE images ADD COLUMN IF NOT EXISTS generation_params JSONB DEFAULT '{}';
ALTER TABLE images ADD COLUMN IF NOT EXISTS original_prompt TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(10) DEFAULT '2:3';
ALTER TABLE images ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE images ADD COLUMN IF NOT EXISTS published_item_id UUID REFERENCES published_items(id);

-- Create comprehensive indexes
CREATE INDEX IF NOT EXISTS published_items_user_id_idx ON published_items(user_id);
CREATE INDEX IF NOT EXISTS published_items_status_idx ON published_items(status);
CREATE INDEX IF NOT EXISTS published_items_created_at_idx ON published_items(created_at DESC);
CREATE INDEX IF NOT EXISTS published_items_price_idx ON published_items(price);
CREATE INDEX IF NOT EXISTS published_items_tags_idx ON published_items USING GIN(tags);

CREATE INDEX IF NOT EXISTS user_profiles_username_idx ON user_profiles(username);
CREATE INDEX IF NOT EXISTS generation_history_user_id_idx ON generation_history(user_id);
CREATE INDEX IF NOT EXISTS generation_history_created_at_idx ON generation_history(created_at DESC);

CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id);
CREATE INDEX IF NOT EXISTS collection_items_collection_id_idx ON collection_items(collection_id);

-- Enable RLS on all new tables
ALTER TABLE published_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for published_items
CREATE POLICY "Published items are viewable by everyone" ON published_items
  FOR SELECT USING (status = 'active');

CREATE POLICY "Users can create their own published items" ON published_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own published items" ON published_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own published items" ON published_items
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_profiles
CREATE POLICY "User profiles are viewable by everyone" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for generation_history
CREATE POLICY "Users can view their own generation history" ON generation_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generation history" ON generation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for collections
CREATE POLICY "Public collections are viewable by everyone" ON collections
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own collections" ON collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" ON collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" ON collections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for collection_items
CREATE POLICY "Collection items follow collection visibility" ON collection_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections c 
      WHERE c.id = collection_id 
      AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can add items to their collections" ON collection_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c 
      WHERE c.id = collection_id 
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove items from their collections" ON collection_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM collections c 
      WHERE c.id = collection_id 
      AND c.user_id = auth.uid()
    )
  );

-- Update existing images RLS to allow user-generated content
DROP POLICY IF EXISTS "Users can insert images" ON images;
CREATE POLICY "Users can insert their generated images" ON images
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view images" ON images;  
CREATE POLICY "Users can view all public images and their own images" ON images
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_published_items_updated_at 
  BEFORE UPDATE ON published_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at 
  BEFORE UPDATE ON collections 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
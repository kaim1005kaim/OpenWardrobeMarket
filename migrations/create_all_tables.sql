-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create images table first
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  r2_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  title TEXT,
  description TEXT,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  colors TEXT[] DEFAULT '{}',
  price DECIMAL(10, 2) DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for images table
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_is_public ON images(is_public);

-- Enable Row Level Security for images
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Create policies for images
-- Anyone can view public images
CREATE POLICY "Anyone can view public images"
  ON images FOR SELECT
  USING (is_public = true);

-- Users can view their own images
CREATE POLICY "Users can view their own images"
  ON images FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own images
CREATE POLICY "Users can create their own images"
  ON images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own images
CREATE POLICY "Users can update their own images"
  ON images FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own images
CREATE POLICY "Users can delete their own images"
  ON images FOR DELETE
  USING (auth.uid() = user_id);

-- Create published_items table (depends on images)
CREATE TABLE IF NOT EXISTS published_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  colors TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for published_items
CREATE INDEX IF NOT EXISTS idx_published_items_user_id ON published_items(user_id);
CREATE INDEX IF NOT EXISTS idx_published_items_image_id ON published_items(image_id);
CREATE INDEX IF NOT EXISTS idx_published_items_created_at ON published_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_items_is_active ON published_items(is_active);

-- Enable Row Level Security for published_items
ALTER TABLE published_items ENABLE ROW LEVEL SECURITY;

-- Create policies for published_items
-- Anyone can view active published items
CREATE POLICY "Anyone can view active published items"
  ON published_items FOR SELECT
  USING (is_active = true);

-- Users can create their own published items
CREATE POLICY "Users can create their own published items"
  ON published_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own published items
CREATE POLICY "Users can update their own published items"
  ON published_items FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own published items
CREATE POLICY "Users can delete their own published items"
  ON published_items FOR DELETE
  USING (auth.uid() = user_id);

-- Create saved_items table
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, image_id)
);

-- Create indexes for saved_items
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_image_id ON saved_items(image_id);

-- Enable Row Level Security for saved_items
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_items
-- Users can view their own saved items
CREATE POLICY "Users can view their own saved items"
  ON saved_items FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own saved items
CREATE POLICY "Users can create their own saved items"
  ON saved_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved items
CREATE POLICY "Users can delete their own saved items"
  ON saved_items FOR DELETE
  USING (auth.uid() = user_id);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, image_id)
);

-- Create indexes for likes
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_image_id ON likes(image_id);

-- Enable Row Level Security for likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Create policies for likes
-- Anyone can view likes
CREATE POLICY "Anyone can view likes"
  ON likes FOR SELECT
  USING (true);

-- Users can create their own likes
CREATE POLICY "Users can create their own likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_images_updated_at
  BEFORE UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_published_items_updated_at
  BEFORE UPDATE ON published_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ すべてのテーブルが正常に作成されました';
END $$;
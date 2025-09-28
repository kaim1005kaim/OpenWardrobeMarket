-- OpenWardrobeMarket Database Schema

-- Generated Images Table
CREATE TABLE generated_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- For future authentication integration
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  colors TEXT[] DEFAULT '{}',
  r2_key TEXT NOT NULL, -- Path in R2 storage (e.g., "user/2025/08/27/uuid.jpg")
  r2_url TEXT NOT NULL, -- Public R2 URL
  is_public BOOLEAN DEFAULT false,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Gallery Table (for private/saved images)
CREATE TABLE user_galleries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- For future authentication
  image_id UUID NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, image_id)
);

-- Indexes for performance
CREATE INDEX idx_generated_images_is_public ON generated_images(is_public);
CREATE INDEX idx_generated_images_created_at ON generated_images(created_at DESC);
CREATE INDEX idx_generated_images_user_id ON generated_images(user_id);
CREATE INDEX idx_user_galleries_user_id ON user_galleries(user_id);
CREATE INDEX idx_generated_images_tags ON generated_images USING GIN(tags);

-- Enable Row Level Security (for future user authentication)
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_galleries ENABLE ROW LEVEL SECURITY;

-- Public images are viewable by everyone
CREATE POLICY "Public images are viewable by everyone" 
  ON generated_images FOR SELECT 
  USING (is_public = true);

-- Users can view their own images (for future implementation)
CREATE POLICY "Users can view their own images" 
  ON generated_images FOR SELECT 
  USING (user_id = auth.uid());

-- Users can insert their own images (for future implementation)  
CREATE POLICY "Users can insert their own images" 
  ON generated_images FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Users can update their own images (for future implementation)
CREATE POLICY "Users can update their own images" 
  ON generated_images FOR UPDATE 
  USING (user_id = auth.uid());

-- Users can manage their own gallery
CREATE POLICY "Users can manage their own gallery" 
  ON user_galleries FOR ALL 
  USING (user_id = auth.uid());
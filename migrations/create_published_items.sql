-- Create published_items table for marketplace
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_published_items_user_id ON published_items(user_id);
CREATE INDEX IF NOT EXISTS idx_published_items_image_id ON published_items(image_id);
CREATE INDEX IF NOT EXISTS idx_published_items_created_at ON published_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_items_is_active ON published_items(is_active);

-- Enable Row Level Security
ALTER TABLE published_items ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_published_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_published_items_updated_at_trigger
  BEFORE UPDATE ON published_items
  FOR EACH ROW
  EXECUTE FUNCTION update_published_items_updated_at();
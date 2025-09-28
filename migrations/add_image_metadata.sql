-- Add image metadata columns to generated_images table

ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
ADD COLUMN IF NOT EXISTS blur_data_url TEXT,
ADD COLUMN IF NOT EXISTS dominant_color TEXT;

-- Create index for aspect ratio (for filtering by orientation)
CREATE INDEX IF NOT EXISTS idx_generated_images_aspect_ratio 
ON generated_images((width::float / NULLIF(height::float, 0)));
-- Add metadata JSONB column to published_items table
-- This will store image dimensions, mime_type, and variants

ALTER TABLE published_items
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN published_items.metadata IS 'Stores image metadata including width, height, mime_type, and variants array';

-- Create index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_published_items_metadata_variants
ON published_items USING gin ((metadata->'variants'));

-- Example metadata structure:
-- {
--   "width": 1024,
--   "height": 1536,
--   "mime_type": "image/png",
--   "variants": [
--     {"type": "side", "r2_url": "...", "status": "completed", "created_at": "..."},
--     {"type": "back", "r2_url": "...", "status": "completed", "created_at": "..."}
--   ]
-- }

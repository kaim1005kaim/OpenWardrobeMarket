-- Migration: Add quadtych_urls column to published_items table
-- Purpose: Store FUSION quadtych panel URLs (MAIN/FRONT/SIDE/BACK views)
-- Date: 2025-12-03

-- Add quadtych_urls column to published_items
ALTER TABLE published_items
ADD COLUMN IF NOT EXISTS quadtych_urls JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN published_items.quadtych_urls IS 'FUSION quadtych panel URLs: {"main": "url", "front": "url", "side": "url", "back": "url"}';

-- Create index for quadtych_urls queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_published_items_quadtych_urls
ON published_items USING GIN (quadtych_urls);

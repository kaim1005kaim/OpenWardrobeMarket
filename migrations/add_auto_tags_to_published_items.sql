-- Add auto_tags column to published_items table for AI-generated tags
-- This enables advanced similarity search and better recommendations

-- Enable pg_trgm extension FIRST (required for gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add auto_tags column (TEXT array for storing AI-generated fashion tags)
ALTER TABLE published_items
ADD COLUMN IF NOT EXISTS auto_tags TEXT[] DEFAULT '{}';

-- Add ai_description column (optional AI-generated image description)
ALTER TABLE published_items
ADD COLUMN IF NOT EXISTS ai_description TEXT;

-- Create GIN index for fast array search on auto_tags
-- GIN (Generalized Inverted Index) is optimized for array containment queries
CREATE INDEX IF NOT EXISTS idx_published_items_auto_tags
ON published_items USING GIN(auto_tags);

-- Create text search index for ai_description (for future full-text search)
-- This index uses trigram similarity from pg_trgm extension
CREATE INDEX IF NOT EXISTS idx_published_items_ai_description_trgm
ON published_items USING GIN(ai_description gin_trgm_ops);

COMMENT ON COLUMN published_items.auto_tags IS
'AI-generated tags from Gemini Vision API (e.g., oversized, streetwear, neutral-tones). Used for similarity search.';

COMMENT ON COLUMN published_items.ai_description IS
'AI-generated description of the design from Gemini Vision API. Used for semantic search.';

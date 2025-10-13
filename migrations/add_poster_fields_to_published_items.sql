-- Add poster_url, original_url, and sale_type fields to published_items table
ALTER TABLE published_items
  ADD COLUMN IF NOT EXISTS poster_url TEXT,
  ADD COLUMN IF NOT EXISTS original_url TEXT,
  ADD COLUMN IF NOT EXISTS sale_type TEXT CHECK (sale_type IN ('buyout', 'subscription')) DEFAULT 'buyout';

-- Create index for poster_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_published_items_poster_url ON published_items(poster_url);

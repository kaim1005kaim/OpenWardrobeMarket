-- Modify published_items to support catalog items with string image_id
-- 1. Drop the foreign key constraint on image_id
ALTER TABLE published_items DROP CONSTRAINT IF EXISTS published_items_image_id_fkey;

-- 2. Change image_id from UUID to TEXT to support both UUID and catalog paths
ALTER TABLE published_items ALTER COLUMN image_id TYPE TEXT USING image_id::TEXT;

-- 3. Make user_id nullable for catalog items (they don't have owners)
ALTER TABLE published_items ALTER COLUMN user_id DROP NOT NULL;

-- 4. Update RLS policies to allow service role to insert catalog items
-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own published items" ON published_items;

-- Create new INSERT policy that allows both user items and catalog items
CREATE POLICY "Users and service can create published items"
  ON published_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id  -- Users can create their own items
    OR user_id IS NULL     -- Catalog items have no user_id
  );

-- 5. Add index on image_id as text
DROP INDEX IF EXISTS idx_published_items_image_id;
CREATE INDEX idx_published_items_image_id ON published_items(image_id);

-- 6. Add index on category for filtering catalog vs user-generated items
CREATE INDEX IF NOT EXISTS idx_published_items_category ON published_items(category);

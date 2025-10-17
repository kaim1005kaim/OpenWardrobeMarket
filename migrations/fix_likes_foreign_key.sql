-- Remove foreign key constraint from likes table to allow liking any asset
-- This allows likes for both images table and published_items table

-- Drop the existing foreign key constraint
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_image_id_fkey;

-- Add a comment to explain the column
COMMENT ON COLUMN likes.image_id IS 'Can reference images.id, published_items.id, or generation_history.id';

-- Ensure the unique constraint still exists
-- (it should, but let's be explicit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'likes_user_id_image_id_key'
  ) THEN
    ALTER TABLE likes ADD CONSTRAINT likes_user_id_image_id_key UNIQUE(user_id, image_id);
  END IF;
END $$;

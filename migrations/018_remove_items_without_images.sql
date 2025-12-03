-- Migration: Remove catalog items without valid image URLs
-- These items have NULL poster_url and original_url, making them unusable in the UI

-- First, log how many items will be affected
DO $$
DECLARE
    item_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO item_count
    FROM published_items
    WHERE category = 'catalog'
      AND poster_url IS NULL
      AND original_url IS NULL;

    RAISE NOTICE 'Found % catalog items without image URLs', item_count;
END $$;

-- Delete catalog items without image URLs
DELETE FROM published_items
WHERE category = 'catalog'
  AND poster_url IS NULL
  AND original_url IS NULL;

-- Log completion
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM published_items
    WHERE category = 'catalog';

    RAISE NOTICE 'Migration complete. % catalog items remain', remaining_count;
END $$;

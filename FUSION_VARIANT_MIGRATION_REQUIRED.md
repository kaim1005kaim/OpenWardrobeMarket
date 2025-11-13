# FUSION Variant Migration Required for Production

## Issue
The variant carousel is not appearing in production because the database schema hasn't been updated yet.

## Current Status
- ✅ Code fix pushed (commit d0d4da44): Changed variant query to use correct column
- ⚠️ **Database migration NOT YET APPLIED to production**

## What's Happening
The logs show `found variants=false` for all items because:

1. **Old behavior (before fix)**:
   - Query checked `metadata->>'variants'` (nested JSON path)
   - This was checking ALL items including catalog items
   - The correct column is `variants` (top-level JSONB column)

2. **New behavior (after fix)**:
   - Query checks `variants` column (top-level)
   - Only queries `mode='fusion'` generations
   - Catalog items no longer checked (they don't have variants)

## Required Migration

The migration file already exists at:
```
migrations/add_fusion_variant_columns.sql
```

This migration adds:
- `seed_main` INTEGER - main generation seed
- `design_tokens` JSONB - extracted garment specification
- `demographic` TEXT - model demographic used
- `variants` JSONB - array of variant metadata
- `mode` TEXT - generation mode ('fusion', 'create', etc.)

## How to Apply Migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/etvmigcsvrvetemyeiez/editor
2. Click "SQL Editor"
3. Copy contents of `migrations/add_fusion_variant_columns.sql`
4. Paste and run

### Option 2: Via psql (if connection works)
```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h db.etvmigcsvrvetemyeiez.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f migrations/add_fusion_variant_columns.sql
```

## Verification Steps

After applying migration:

1. **Check columns exist:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'generation_history'
  AND column_name IN ('variants', 'mode', 'seed_main', 'design_tokens', 'demographic')
ORDER BY column_name;
```

Expected output:
```
  column_name   | data_type
----------------+-----------
 demographic    | text
 design_tokens  | jsonb
 mode           | text
 seed_main      | integer
 variants       | jsonb
```

2. **Check FUSION generations exist:**
```sql
SELECT COUNT(*) as fusion_count
FROM generation_history
WHERE mode = 'fusion';
```

Should return non-zero count if FUSION has been used.

3. **Check if any have variants data:**
```sql
SELECT id, mode,
       jsonb_array_length(variants) as variant_count,
       variants
FROM generation_history
WHERE mode = 'fusion'
  AND variants IS NOT NULL
  AND jsonb_array_length(variants) > 0
LIMIT 5;
```

## Testing After Migration

1. Create a new FUSION generation
2. Go to publish page
3. Verify carousel appears with SIDE and BACK loading states
4. Wait for variants to generate
5. Check variants appear in carousel

## Files Changed

- `app/api/assets/route.ts` - Fixed variant query (line 149-172)
  - Changed from `metadata->>variants` to `variants` column
  - Added `mode='fusion'` filter
  - Updated to read `gen.variants` instead of `gen.metadata.variants`

## Migration SQL Content

```sql
-- Add columns for FUSION variant generation system
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS seed_main INTEGER;

ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS design_tokens JSONB;

ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS demographic TEXT;

ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS mode TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_generation_history_mode
ON generation_history(mode);

CREATE INDEX IF NOT EXISTS idx_generation_history_seed_main
ON generation_history(seed_main);
```

## Expected Result After Migration

Once migration is applied and code is deployed:
- FUSION generations will have carousel with FRONT/SIDE/BACK views
- Catalog items won't show carousel (no variants)
- CREATE mode items won't show carousel (no variants)
- Logs will show "found variants=true" for FUSION items with variants
- Logs will only check FUSION generations, not all items

---

**Status**: ⚠️ Waiting for database migration to be applied to production
**Deployed Code**: ✅ Ready (commit d0d4da44)

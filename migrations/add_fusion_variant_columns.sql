-- Add columns for FUSION variant generation system
-- Adds seed_main, design_tokens, demographic, variants to generation_history

-- Add seed_main for reproducible variant generation
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS seed_main INTEGER;

-- Add design_tokens (jsonb) for garment specification
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS design_tokens JSONB;

-- Add demographic for model description
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS demographic TEXT;

-- Add variants array to track SIDE/BACK generation
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- Add mode column if it doesn't exist (for filtering FUSION generations)
ALTER TABLE generation_history
ADD COLUMN IF NOT EXISTS mode TEXT;

-- Create index on mode for faster queries
CREATE INDEX IF NOT EXISTS idx_generation_history_mode ON generation_history(mode);

-- Create index on seed_main for reproducibility queries
CREATE INDEX IF NOT EXISTS idx_generation_history_seed_main ON generation_history(seed_main);

-- Add comment explaining the new columns
COMMENT ON COLUMN generation_history.seed_main IS 'Main generation seed for reproducible SIDE/BACK variants';
COMMENT ON COLUMN generation_history.design_tokens IS 'Extracted garment specification (colors, materials, details) for consistent variants';
COMMENT ON COLUMN generation_history.demographic IS 'Model demographic used in generation (e.g., jp_f_20s)';
COMMENT ON COLUMN generation_history.variants IS 'Array of variant metadata: [{type: "side"|"back", r2_url: string, status: "pending"|"generating"|"completed"|"failed", tries: number, view_conf: number, sim_score: number}]';
COMMENT ON COLUMN generation_history.mode IS 'Generation mode: "fusion", "create", etc.';

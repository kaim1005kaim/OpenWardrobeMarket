-- Add FUSION mode fields to generation_history table
-- These fields support auto-category, auto-tags, and AI description features

-- Add metadata column for structured data (DNA, vibe_vector, variants, etc.)
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add tags column for storing AI-generated tags
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS tags text[];

-- Add status column for tracking generation progress
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Add r2_key and r2_url columns for direct R2 references
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS r2_key text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS r2_url text;

-- Create index for faster tag queries
CREATE INDEX IF NOT EXISTS idx_generation_history_tags ON public.generation_history USING GIN(tags);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_generation_history_status ON public.generation_history(status);

-- Add comment for documentation
COMMENT ON COLUMN public.generation_history.metadata IS 'Structured metadata including DNA, vibe_vector, variants, ai_description, embedding, etc.';
COMMENT ON COLUMN public.generation_history.tags IS 'AI-generated tags from Gemini vision analysis';
COMMENT ON COLUMN public.generation_history.status IS 'Generation status: pending, processing, completed, or failed';

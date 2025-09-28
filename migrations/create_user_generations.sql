-- Create user generations table for storing generated assets
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Create user_generations table
CREATE TABLE IF NOT EXISTS user_generations (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  job_id text NOT NULL,
  image_id text, -- ImagineAPI's image_id
  title text,
  prompt text,
  mode text, -- simple, heritage, zero, mutation
  parameters jsonb,
  r2_url text NOT NULL,
  width integer,
  height integer,
  imagine_image_index integer DEFAULT 1,
  is_public boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_generations_user_id ON user_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_job_id ON user_generations(job_id);
CREATE INDEX IF NOT EXISTS idx_user_generations_created_at ON user_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_generations_is_deleted ON user_generations(is_deleted);

-- Enable RLS
ALTER TABLE user_generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS p_user_generations_read ON user_generations;
DROP POLICY IF EXISTS p_user_generations_insert ON user_generations;
DROP POLICY IF EXISTS p_user_generations_update ON user_generations;
DROP POLICY IF EXISTS p_user_generations_delete ON user_generations;

-- Create policies (users can only see their own generations)
CREATE POLICY p_user_generations_read 
ON user_generations FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY p_user_generations_insert
ON user_generations FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY p_user_generations_update
ON user_generations FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY p_user_generations_delete
ON user_generations FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- Grant permissions
GRANT ALL ON user_generations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_generations_id_seq TO authenticated;

-- Verify table was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_generations') THEN
    RAISE NOTICE '✅ user_generations table created successfully';
  ELSE
    RAISE NOTICE '❌ user_generations table creation failed';
  END IF;
END $$;
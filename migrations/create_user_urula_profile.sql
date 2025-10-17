-- Create user_urula_profile table for adaptive Urula appearance
CREATE TABLE IF NOT EXISTS public.user_urula_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Material weights (0..1, sum to ~1.0)
  mat_weights JSONB NOT NULL DEFAULT '{"canvas":0.34,"denim":0.33,"leather":0.33,"pinstripe":0.2}'::jsonb,

  -- Glass rib preference (0..1)
  glass_gene FLOAT8 NOT NULL DEFAULT 0.5,

  -- Shape waviness (0.2..0.6)
  chaos FLOAT8 NOT NULL DEFAULT 0.35,

  -- HSL tint
  tint JSONB NOT NULL DEFAULT '{"h":160,"s":0.25,"l":0.75}'::jsonb,

  -- Color palette (main + accents)
  palette JSONB NOT NULL DEFAULT '{"main":[160,0.25,0.75],"accents":[]}'::jsonb,

  -- Usage history
  history JSONB NOT NULL DEFAULT '{"generations":0,"likes":0,"publishes":0,"lastTags":[],"lastColors":[]}'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_urula_profile ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own urula profile"
  ON public.user_urula_profile
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own urula profile"
  ON public.user_urula_profile
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own urula profile"
  ON public.user_urula_profile
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_urula_profile_user_id ON public.user_urula_profile(user_id);

-- Add comment
COMMENT ON TABLE public.user_urula_profile IS 'Stores per-user Urula appearance preferences that evolve based on generation history';

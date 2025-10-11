-- generation_historyテーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS public.generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'imagineapi',
  model text NOT NULL DEFAULT 'midjourney',
  prompt text,
  negative_prompt text,
  aspect_ratio text DEFAULT '3:4',
  seed bigint,
  image_bucket text,
  image_path text,
  image_url text,
  folder text DEFAULT 'usergen',
  mode text DEFAULT 'mobile-simple',
  generation_data jsonb,
  is_public boolean DEFAULT false,
  preview_path text,
  preview_url text,
  published_at timestamptz,
  completion_status text NOT NULL DEFAULT 'completed',
  external_id text,
  created_at timestamptz DEFAULT now()
);

-- 既存テーブルにカラムを追加（存在しない場合）
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'imagineapi';

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS model text DEFAULT 'midjourney';

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS prompt text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS negative_prompt text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '3:4';

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS folder text DEFAULT 'usergen';

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS mode text DEFAULT 'mobile-simple';

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS seed bigint;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS image_bucket text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS generation_data jsonb;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS preview_path text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS preview_url text;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS completion_status text DEFAULT 'completed';

-- RLSを有効化
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

-- external_idのインデックス作成（webhook検索を高速化）
CREATE INDEX IF NOT EXISTS idx_generation_history_external_id
ON public.generation_history(external_id);

-- RLSポリシーを削除して再作成
DROP POLICY IF EXISTS "select own" ON public.generation_history;
DROP POLICY IF EXISTS "insert own" ON public.generation_history;
DROP POLICY IF EXISTS "update own" ON public.generation_history;

-- 新しいRLSポリシー（認証済みユーザーが自分のレコードにアクセス可能）
CREATE POLICY "select own" ON public.generation_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert own" ON public.generation_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own" ON public.generation_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

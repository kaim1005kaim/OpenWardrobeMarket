-- DNA Sessions table for invisible/debounced save
create table if not exists public.dna_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  answers jsonb,
  free_text text,
  gemini_tags jsonb,
  dna jsonb not null,
  prompt_preview text,
  updated_at timestamptz default now(),
  primary key (user_id, session_key)
);

-- RLS policies
alter table public.dna_sessions enable row level security;

create policy "dna_sessions: users can read own sessions"
  on public.dna_sessions for select
  using (auth.uid() = user_id);

create policy "dna_sessions: users can insert own sessions"
  on public.dna_sessions for insert
  with check (auth.uid() = user_id);

create policy "dna_sessions: users can update own sessions"
  on public.dna_sessions for update
  using (auth.uid() = user_id);

-- Add lineage columns to assets table
alter table public.assets
  add column if not exists parent_asset_id uuid references public.assets(id) on delete set null,
  add column if not exists lineage_tags text[] default '{}',
  add column if not exists dna jsonb;

-- Add index for parent lookups
create index if not exists idx_assets_parent on public.assets(parent_asset_id);

-- Add lineage columns to generation_history (if exists)
alter table public.generation_history
  add column if not exists parent_asset_id uuid,
  add column if not exists dna jsonb;

-- Add index for efficient DNA session lookups
create index if not exists idx_dna_sessions_updated on public.dna_sessions(user_id, updated_at desc);

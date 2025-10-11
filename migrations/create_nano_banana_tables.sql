-- Nano Banana用のテーブル作成
-- 生成履歴
create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'gemini',
  model text not null default 'gemini-2.5-flash-image',
  prompt text,
  negative_prompt text,
  aspect_ratio text default '3:4',
  seed bigint,
  image_bucket text,
  image_path text,
  image_url text,                 -- R2の公開URL or 署名URL
  folder text default 'usergen',  -- 'usergen' | 'public' | 'catalog' 等の分類
  mode text default 'mobile-simple',
  generation_data jsonb,
  is_public boolean default false,
  preview_path text,              -- 公開用プレビュー（透かし）
  preview_url text,
  published_at timestamptz,
  completion_status text not null default 'completed',
  created_at timestamptz default now()
);
alter table public.generation_history enable row level security;
create policy "select own" on public.generation_history for select using (auth.uid() = user_id);
create policy "insert own" on public.generation_history for insert with check (auth.uid() = user_id);
create policy "update own" on public.generation_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- マーケット出品
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  history_id uuid not null references public.generation_history(id) on delete cascade,
  title text,
  tags text[],
  license_type text not null default 'non-exclusive',  -- 'exclusive'|'non-exclusive'|'single-use'
  price_cents int not null,
  currency text not null default 'JPY',
  max_sales int,
  total_sold int not null default 0,
  status text not null default 'active', -- 'active'|'paused'|'sold_out'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.listings enable row level security;
create policy "owner can crud" on public.listings
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "public can read active" on public.listings
  for select using (status = 'active');

-- 注文
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  amount_cents int not null,
  currency text not null default 'JPY',
  stripe_session_id text,
  stripe_payment_intent text,
  status text not null default 'pending', -- 'pending'|'paid'|'expired'|'refunded'
  deliver_path text,          -- R2: deliver/{orderId}/package.zip
  deliver_url text,           -- 署名URL（期限付き）
  created_at timestamptz default now(),
  paid_at timestamptz
);
alter table public.orders enable row level security;
create policy "buyer can read own" on public.orders for select using (auth.uid() = buyer_id);
create policy "buyer can insert own" on public.orders for insert with check (auth.uid() = buyer_id);

-- 売上カウント用の簡易RPC（任意）
create or replace function public.increment_listing_sold(p_listing_id uuid)
returns void language sql as $$
  update public.listings set total_sold = total_sold + 1 where id = p_listing_id;
$$;

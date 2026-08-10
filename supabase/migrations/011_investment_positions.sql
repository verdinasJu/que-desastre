-- Cartera de inversiones: coste (lo metido) + cantidad; valor actual vía API/precio
create table if not exists public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  asset_kind text not null check (asset_kind in ('crypto', 'etf', 'stock', 'other')),
  symbol text,
  quantity numeric(24, 10) not null default 0 check (quantity >= 0),
  cost_basis numeric(12, 2) not null default 0 check (cost_basis >= 0),
  manual_value numeric(12, 2),
  last_price numeric(24, 10),
  last_value numeric(12, 2),
  priced_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investment_positions_user_idx
  on public.investment_positions (user_id);

alter table public.investment_positions enable row level security;

grant select, insert, update, delete on table public.investment_positions to authenticated;

drop policy if exists "investment_positions_select_own" on public.investment_positions;
create policy "investment_positions_select_own" on public.investment_positions
  for select using (auth.uid() = user_id);

drop policy if exists "investment_positions_insert_own" on public.investment_positions;
create policy "investment_positions_insert_own" on public.investment_positions
  for insert with check (auth.uid() = user_id);

drop policy if exists "investment_positions_update_own" on public.investment_positions;
create policy "investment_positions_update_own" on public.investment_positions
  for update using (auth.uid() = user_id);

drop policy if exists "investment_positions_delete_own" on public.investment_positions;
create policy "investment_positions_delete_own" on public.investment_positions
  for delete using (auth.uid() = user_id);

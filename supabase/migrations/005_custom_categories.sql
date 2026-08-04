create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income', 'investment')),
  created_at timestamptz not null default now(),
  unique (user_id, type, name)
);

create index if not exists custom_categories_user_idx
  on public.custom_categories (user_id);

alter table public.custom_categories enable row level security;

grant select, insert, update, delete on table public.custom_categories to authenticated;
grant select on table public.custom_categories to anon;

drop policy if exists "custom_categories_select_own" on public.custom_categories;
create policy "custom_categories_select_own" on public.custom_categories
  for select using (auth.uid() = user_id);
drop policy if exists "custom_categories_insert_own" on public.custom_categories;
create policy "custom_categories_insert_own" on public.custom_categories
  for insert with check (auth.uid() = user_id);
drop policy if exists "custom_categories_update_own" on public.custom_categories;
create policy "custom_categories_update_own" on public.custom_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "custom_categories_delete_own" on public.custom_categories;
create policy "custom_categories_delete_own" on public.custom_categories
  for delete using (auth.uid() = user_id);

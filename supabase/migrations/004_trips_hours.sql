alter table public.profiles
  add column if not exists hours_per_month numeric(6,2) not null default 160;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.transactions
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

create index if not exists trips_user_idx on public.trips (user_id);
create index if not exists transactions_trip_idx on public.transactions (trip_id);

alter table public.trips enable row level security;

grant select, insert, update, delete on table public.trips to authenticated;
grant select on table public.trips to anon;

drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);
drop policy if exists "trips_insert_own" on public.trips;
create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);
drop policy if exists "trips_update_own" on public.trips;
create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "trips_delete_own" on public.trips;
create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);

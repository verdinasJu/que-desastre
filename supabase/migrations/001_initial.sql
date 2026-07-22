-- Que Desastre / MiDinero — esquema inicial
-- Pegar en Supabase → SQL Editor → Run

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  monthly_salary numeric(12,2) not null default 0,
  initial_savings numeric(12,2) not null default 0,
  initial_investments numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fixed expenses
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null default 'Fijos',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Transactions (income | expense | investment)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'investment')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '',
  category text not null default 'Otros',
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

create index if not exists transactions_user_type_idx
  on public.transactions (user_id, type);

create index if not exists fixed_expenses_user_idx
  on public.fixed_expenses (user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo el trigger (service role) debe poder ejecutarla
revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.handle_new_user() to postgres, service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.transactions enable row level security;

-- Permisos de tabla (sin esto RLS no basta: sale "permission denied")
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.fixed_expenses to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select on table public.profiles to anon;
grant select on table public.fixed_expenses to anon;
grant select on table public.transactions to anon;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Fixed expenses policies
drop policy if exists "fixed_expenses_select_own" on public.fixed_expenses;
create policy "fixed_expenses_select_own" on public.fixed_expenses
  for select using (auth.uid() = user_id);

drop policy if exists "fixed_expenses_insert_own" on public.fixed_expenses;
create policy "fixed_expenses_insert_own" on public.fixed_expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists "fixed_expenses_update_own" on public.fixed_expenses;
create policy "fixed_expenses_update_own" on public.fixed_expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fixed_expenses_delete_own" on public.fixed_expenses;
create policy "fixed_expenses_delete_own" on public.fixed_expenses
  for delete using (auth.uid() = user_id);

-- Transactions policies
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

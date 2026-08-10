-- Deudas: lo que debes tú o te deben a ti (no afecta patrimonio hasta que lo marques)

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('i_owe', 'they_owe')),
  person_name text not null,
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  due_date date,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  check (paid_amount <= amount)
);

create index if not exists debts_user_idx on public.debts (user_id);
create index if not exists debts_user_open_idx on public.debts (user_id, settled)
  where settled = false;

alter table public.debts enable row level security;

grant select, insert, update, delete on table public.debts to authenticated;

drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own" on public.debts
  for select using (auth.uid() = user_id);
drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own" on public.debts
  for insert with check (auth.uid() = user_id);
drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own" on public.debts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own" on public.debts
  for delete using (auth.uid() = user_id);

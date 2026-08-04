-- Shared budgets + trip members + one-time invite codes

create table if not exists public.shared_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_budget_members (
  shared_budget_id uuid not null references public.shared_budgets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  color text not null default '#0f766e',
  label text not null default 'Miembro',
  joined_at timestamptz not null default now(),
  primary key (shared_budget_id, user_id)
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  color text not null default '#0284c7',
  label text not null default 'Miembro',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  resource_type text not null check (resource_type in ('budget', 'trip')),
  resource_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists shared_budgets_owner_idx on public.shared_budgets (owner_id);
create index if not exists shared_budget_members_user_idx on public.shared_budget_members (user_id);
create index if not exists trip_members_user_idx on public.trip_members (user_id);
create index if not exists invite_codes_code_idx on public.invite_codes (code);

alter table public.shared_budgets enable row level security;
alter table public.shared_budget_members enable row level security;
alter table public.trip_members enable row level security;
alter table public.invite_codes enable row level security;

grant select, insert, update, delete on table public.shared_budgets to authenticated;
grant select, insert, update, delete on table public.shared_budget_members to authenticated;
grant select, insert, update, delete on table public.trip_members to authenticated;
grant select, insert, update, delete on table public.invite_codes to authenticated;

-- Helpers
create or replace function public.is_shared_budget_member(p_budget_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_budget_members m
    where m.shared_budget_id = p_budget_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid()
  )
  or exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;

revoke all on function public.is_shared_budget_member(uuid) from public;
revoke all on function public.is_trip_member(uuid) from public;
grant execute on function public.is_shared_budget_member(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;

-- shared_budgets policies
drop policy if exists "shared_budgets_select" on public.shared_budgets;
create policy "shared_budgets_select" on public.shared_budgets
  for select using (
    auth.uid() = owner_id or public.is_shared_budget_member(id)
  );
drop policy if exists "shared_budgets_insert" on public.shared_budgets;
create policy "shared_budgets_insert" on public.shared_budgets
  for insert with check (auth.uid() = owner_id);
drop policy if exists "shared_budgets_update" on public.shared_budgets;
create policy "shared_budgets_update" on public.shared_budgets
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "shared_budgets_delete" on public.shared_budgets;
create policy "shared_budgets_delete" on public.shared_budgets
  for delete using (auth.uid() = owner_id);

-- shared_budget_members
drop policy if exists "sbm_select" on public.shared_budget_members;
create policy "sbm_select" on public.shared_budget_members
  for select using (public.is_shared_budget_member(shared_budget_id));
drop policy if exists "sbm_insert" on public.shared_budget_members;
create policy "sbm_insert" on public.shared_budget_members
  for insert with check (
    exists (
      select 1 from public.shared_budgets b
      where b.id = shared_budget_id and b.owner_id = auth.uid()
    )
    or auth.uid() = user_id
  );
drop policy if exists "sbm_delete" on public.shared_budget_members;
create policy "sbm_delete" on public.shared_budget_members
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_budgets b
      where b.id = shared_budget_id and b.owner_id = auth.uid()
    )
  );

-- trip_members
drop policy if exists "tm_select" on public.trip_members;
create policy "tm_select" on public.trip_members
  for select using (public.is_trip_member(trip_id));
drop policy if exists "tm_insert" on public.trip_members;
create policy "tm_insert" on public.trip_members
  for insert with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
    or auth.uid() = user_id
  );
drop policy if exists "tm_delete" on public.trip_members;
create policy "tm_delete" on public.trip_members
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

-- trips: members can also select
drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own" on public.trips
  for select using (
    auth.uid() = user_id or public.is_trip_member(id)
  );

-- invite_codes: creator can see own; nobody else reads unused codes via table
drop policy if exists "invite_select_own" on public.invite_codes;
create policy "invite_select_own" on public.invite_codes
  for select using (auth.uid() = created_by);
drop policy if exists "invite_insert_own" on public.invite_codes;
create policy "invite_insert_own" on public.invite_codes
  for insert with check (auth.uid() = created_by);
drop policy if exists "invite_update_own" on public.invite_codes;
create policy "invite_update_own" on public.invite_codes
  for update using (auth.uid() = created_by);

-- Generate short code
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Create invite (owner only)
create or replace function public.create_share_invite(
  p_resource_type text,
  p_resource_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_ok boolean := false;
  attempt int := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_resource_type = 'budget' then
    select exists (
      select 1 from public.shared_budgets b
      where b.id = p_resource_id and b.owner_id = auth.uid()
    ) into v_ok;
  elsif p_resource_type = 'trip' then
    select exists (
      select 1 from public.trips t
      where t.id = p_resource_id and t.user_id = auth.uid()
    ) into v_ok;
  else
    raise exception 'Tipo inválido';
  end if;

  if not v_ok then
    raise exception 'No tienes permiso para invitar';
  end if;

  loop
    attempt := attempt + 1;
    v_code := public.generate_invite_code();
    begin
      insert into public.invite_codes (code, resource_type, resource_id, created_by)
      values (v_code, p_resource_type, p_resource_id, auth.uid());
      exit;
    exception when unique_violation then
      if attempt > 10 then
        raise;
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

-- Redeem one-time invite
create or replace function public.redeem_share_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invite_codes%rowtype;
  v_color text;
  v_label text;
  v_member_count int;
  colors text[] := array['#0f766e', '#c2410c', '#7c3aed', '#0284c7', '#be185d'];
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_inv
  from public.invite_codes
  where upper(trim(p_code)) = code
  for update;

  if not found then
    raise exception 'Código no válido';
  end if;

  if v_inv.used_at is not null then
    raise exception 'Este código ya se ha usado';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Este código ha caducado';
  end if;

  if v_inv.created_by = auth.uid() then
    raise exception 'No puedes usar tu propio código';
  end if;

  v_label := 'Invitado';

  if v_inv.resource_type = 'budget' then
    if not exists (select 1 from public.shared_budgets where id = v_inv.resource_id) then
      raise exception 'Presupuesto no encontrado';
    end if;
    if exists (
      select 1 from public.shared_budget_members
      where shared_budget_id = v_inv.resource_id and user_id = auth.uid()
    ) then
      raise exception 'Ya formas parte de este presupuesto';
    end if;
    select count(*) into v_member_count
    from public.shared_budget_members
    where shared_budget_id = v_inv.resource_id;
    v_color := colors[1 + (v_member_count % array_length(colors, 1))];
    insert into public.shared_budget_members (shared_budget_id, user_id, color, label)
    values (v_inv.resource_id, auth.uid(), v_color, v_label);
  elsif v_inv.resource_type = 'trip' then
    if not exists (select 1 from public.trips where id = v_inv.resource_id) then
      raise exception 'Viaje no encontrado';
    end if;
    if exists (
      select 1 from public.trip_members
      where trip_id = v_inv.resource_id and user_id = auth.uid()
    ) then
      raise exception 'Ya formas parte de este viaje';
    end if;
    -- ensure owner is a member row for consistent colors
    insert into public.trip_members (trip_id, user_id, color, label)
    select t.id, t.user_id, colors[1], 'Tú'
    from public.trips t
    where t.id = v_inv.resource_id
    on conflict do nothing;

    select count(*) into v_member_count
    from public.trip_members
    where trip_id = v_inv.resource_id;
    v_color := colors[1 + (v_member_count % array_length(colors, 1))];
    insert into public.trip_members (trip_id, user_id, color, label)
    values (v_inv.resource_id, auth.uid(), v_color, v_label);
  end if;

  update public.invite_codes
  set used_by = auth.uid(), used_at = now()
  where id = v_inv.id;

  return jsonb_build_object(
    'resource_type', v_inv.resource_type,
    'resource_id', v_inv.resource_id
  );
end;
$$;

-- Spending breakdown for shared budget (current month)
create or replace function public.shared_budget_spending(
  p_budget_id uuid,
  p_start date,
  p_end date
)
returns table (
  user_id uuid,
  label text,
  color text,
  spent numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_category text;
begin
  if not public.is_shared_budget_member(p_budget_id) then
    raise exception 'Sin acceso';
  end if;

  select category into v_category from public.shared_budgets where id = p_budget_id;

  return query
  select
    m.user_id,
    m.label,
    m.color,
    coalesce((
      select sum(t.amount)::numeric
      from public.transactions t
      where t.user_id = m.user_id
        and t.type = 'expense'
        and t.category = v_category
        and t.date >= p_start
        and t.date <= p_end
    ), 0) as spent
  from public.shared_budget_members m
  where m.shared_budget_id = p_budget_id
  order by m.joined_at;
end;
$$;

-- Spending breakdown for shared trip
create or replace function public.trip_shared_spending(p_trip_id uuid)
returns table (
  user_id uuid,
  label text,
  color text,
  spent numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_start date;
  v_end date;
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'Sin acceso';
  end if;

  select start_date, end_date into v_start, v_end
  from public.trips where id = p_trip_id;

  -- include owner as member if missing
  insert into public.trip_members (trip_id, user_id, color, label)
  select t.id, t.user_id, '#0f766e', 'Tú'
  from public.trips t
  where t.id = p_trip_id
  on conflict do nothing;

  return query
  select
    m.user_id,
    case when m.user_id = auth.uid() then 'Tú' else m.label end,
    m.color,
    coalesce((
      select sum(t.amount)::numeric
      from public.transactions t
      where t.user_id = m.user_id
        and t.type = 'expense'
        and (
          t.trip_id = p_trip_id
          or (t.date >= v_start and t.date <= v_end)
        )
    ), 0) as spent
  from public.trip_members m
  where m.trip_id = p_trip_id
  order by m.joined_at;
end;
$$;

revoke all on function public.create_share_invite(text, uuid) from public;
revoke all on function public.redeem_share_invite(text) from public;
revoke all on function public.shared_budget_spending(uuid, date, date) from public;
revoke all on function public.trip_shared_spending(uuid) from public;
grant execute on function public.create_share_invite(text, uuid) to authenticated;
grant execute on function public.redeem_share_invite(text) to authenticated;
grant execute on function public.shared_budget_spending(uuid, date, date) to authenticated;
grant execute on function public.trip_shared_spending(uuid) to authenticated;

-- When creating shared budget, owner becomes first member
create or replace function public.create_shared_budget(
  p_category text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Importe inválido';
  end if;

  insert into public.shared_budgets (owner_id, category, amount)
  values (auth.uid(), trim(p_category), p_amount)
  returning id into v_id;

  insert into public.shared_budget_members (shared_budget_id, user_id, color, label)
  values (v_id, auth.uid(), '#0f766e', 'Tú');

  return v_id;
end;
$$;

revoke all on function public.create_shared_budget(text, numeric) from public;
grant execute on function public.create_shared_budget(text, numeric) to authenticated;

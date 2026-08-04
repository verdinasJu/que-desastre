-- Harden sharing: RLS, labels, trip spending, invite invalidation

drop policy if exists "sbm_insert" on public.shared_budget_members;
create policy "sbm_insert" on public.shared_budget_members
  for insert with check (
    exists (
      select 1 from public.shared_budgets b
      where b.id = shared_budget_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "tm_insert" on public.trip_members;
create policy "tm_insert" on public.trip_members
  for insert with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

revoke insert on table public.invite_codes from authenticated;
drop policy if exists "invite_insert_own" on public.invite_codes;

create or replace function public.trip_shared_spending(p_trip_id uuid)
returns table (user_id uuid, label text, color text, spent numeric)
language plpgsql security definer set search_path = public stable as $$
declare
  v_start date;
  v_end date;
begin
  if not public.is_trip_member(p_trip_id) then raise exception 'Sin acceso'; end if;
  select start_date, end_date into v_start, v_end from public.trips where id = p_trip_id;
  insert into public.trip_members (trip_id, user_id, color, label)
  select t.id, t.user_id, '#0f766e', 'Organizador' from public.trips t where t.id = p_trip_id
  on conflict do nothing;
  return query
  select m.user_id, m.label, m.color,
    coalesce((select sum(t.amount)::numeric from public.transactions t
      where t.user_id = m.user_id and t.type = 'expense'
        and (
          t.trip_id = p_trip_id
          or (t.trip_id is null and t.date >= v_start and t.date <= v_end)
        )), 0) as spent
  from public.trip_members m
  where m.trip_id = p_trip_id
  order by m.joined_at;
end;
$$;

create or replace function public.create_shared_budget(p_category text, p_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Importe inválido'; end if;
  insert into public.shared_budgets (owner_id, category, amount)
  values (auth.uid(), trim(p_category), p_amount) returning id into v_id;
  insert into public.shared_budget_members (shared_budget_id, user_id, color, label)
  values (v_id, auth.uid(), '#0f766e', 'Organizador');
  return v_id;
end;
$$;

create or replace function public.redeem_share_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invite_codes%rowtype;
  v_color text;
  v_label text;
  v_member_count int;
  colors text[] := array['#0f766e', '#c2410c', '#7c3aed', '#0284c7', '#be185d'];
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_inv from public.invite_codes where upper(trim(p_code)) = code for update;
  if not found then raise exception 'Código no válido'; end if;
  if v_inv.used_at is not null then raise exception 'Este código ya se ha usado'; end if;
  if v_inv.expires_at < now() then raise exception 'Este código ha caducado'; end if;
  if v_inv.created_by = auth.uid() then raise exception 'No puedes usar tu propio código'; end if;
  v_label := 'Invitado';
  if v_inv.resource_type = 'budget' then
    if not exists (select 1 from public.shared_budgets where id = v_inv.resource_id) then raise exception 'Presupuesto no encontrado'; end if;
    if exists (select 1 from public.shared_budget_members where shared_budget_id = v_inv.resource_id and user_id = auth.uid()) then raise exception 'Ya formas parte de este presupuesto'; end if;
    select count(*) into v_member_count from public.shared_budget_members where shared_budget_id = v_inv.resource_id;
    v_color := colors[1 + (v_member_count % array_length(colors, 1))];
    insert into public.shared_budget_members (shared_budget_id, user_id, color, label)
    values (v_inv.resource_id, auth.uid(), v_color, v_label);
  elsif v_inv.resource_type = 'trip' then
    if not exists (select 1 from public.trips where id = v_inv.resource_id) then raise exception 'Viaje no encontrado'; end if;
    if exists (select 1 from public.trip_members where trip_id = v_inv.resource_id and user_id = auth.uid()) then raise exception 'Ya formas parte de este viaje'; end if;
    insert into public.trip_members (trip_id, user_id, color, label)
    select t.id, t.user_id, colors[1], 'Organizador' from public.trips t where t.id = v_inv.resource_id
    on conflict do nothing;
    select count(*) into v_member_count from public.trip_members where trip_id = v_inv.resource_id;
    v_color := colors[1 + (v_member_count % array_length(colors, 1))];
    insert into public.trip_members (trip_id, user_id, color, label)
    values (v_inv.resource_id, auth.uid(), v_color, v_label);
  end if;
  update public.invite_codes set used_by = auth.uid(), used_at = now() where id = v_inv.id;
  return jsonb_build_object('resource_type', v_inv.resource_type, 'resource_id', v_inv.resource_id);
end;
$$;

create or replace function public.create_share_invite(p_resource_type text, p_resource_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_ok boolean := false;
  attempt int := 0;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_resource_type = 'budget' then
    select exists (select 1 from public.shared_budgets b where b.id = p_resource_id and b.owner_id = auth.uid()) into v_ok;
  elsif p_resource_type = 'trip' then
    select exists (select 1 from public.trips t where t.id = p_resource_id and t.user_id = auth.uid()) into v_ok;
  else raise exception 'Tipo inválido';
  end if;
  if not v_ok then raise exception 'No tienes permiso para invitar'; end if;
  update public.invite_codes
  set used_at = now()
  where resource_type = p_resource_type
    and resource_id = p_resource_id
    and created_by = auth.uid()
    and used_at is null;
  loop
    attempt := attempt + 1;
    v_code := public.generate_invite_code();
    begin
      insert into public.invite_codes (code, resource_type, resource_id, created_by)
      values (v_code, p_resource_type, p_resource_id, auth.uid());
      exit;
    exception when unique_violation then
      if attempt > 10 then raise; end if;
    end;
  end loop;
  return v_code;
end;
$$;

update public.shared_budget_members set label = 'Organizador' where label = 'Tú';
update public.trip_members set label = 'Organizador' where label = 'Tú';

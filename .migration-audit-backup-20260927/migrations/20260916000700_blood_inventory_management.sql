-- Phase 7: Blood inventory management (web admin + shared Supabase backend).
--
-- Goals:
--   * Normalized stock by blood bank profile + blood type
--   * Authoritative stable/low/critical status from configurable thresholds
--   * Auditable adjustments (history table)
--   * Secure RPCs for ensure / adjust / threshold updates
--   * RLS: admin all, verified bloodbank own only; donors/recipients denied
--   * Realtime on inventory + adjustments
--
-- Does NOT:
--   * Auto add/deduct from donations or fulfilled requests
--   * Introduce a Healthcare Personnel role
--   * Replace is_bloodbank_verified()

-- ----------------------------------------------------------------------------
-- 1) Types
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.inventory_stock_status as enum ('stable', 'low', 'critical');
exception
  when duplicate_object then null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Tables
-- ----------------------------------------------------------------------------
create table if not exists public.blood_inventory (
  id uuid primary key default gen_random_uuid(),
  bloodbank_id uuid not null references public.profiles(id) on delete cascade,
  blood_type public.blood_type not null,
  quantity integer not null default 0,
  low_threshold integer not null default 15,
  critical_threshold integer not null default 5,
  stock_status public.inventory_stock_status
    generated always as (
      case
        when quantity <= critical_threshold then 'critical'::public.inventory_stock_status
        when quantity <= low_threshold then 'low'::public.inventory_stock_status
        else 'stable'::public.inventory_stock_status
      end
    ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blood_inventory_quantity_non_negative check (quantity >= 0),
  constraint blood_inventory_low_threshold_non_negative check (low_threshold >= 0),
  constraint blood_inventory_critical_threshold_non_negative check (critical_threshold >= 0),
  constraint blood_inventory_thresholds_ordered check (critical_threshold <= low_threshold),
  constraint blood_inventory_bloodbank_type_unique unique (bloodbank_id, blood_type)
);

create index if not exists blood_inventory_bloodbank_idx
  on public.blood_inventory (bloodbank_id);

create index if not exists blood_inventory_status_idx
  on public.blood_inventory (stock_status);

create index if not exists blood_inventory_blood_type_idx
  on public.blood_inventory (blood_type);

drop trigger if exists blood_inventory_set_updated_at on public.blood_inventory;
create trigger blood_inventory_set_updated_at
before update on public.blood_inventory
for each row execute function public.set_updated_at();

create table if not exists public.blood_inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.blood_inventory(id) on delete cascade,
  previous_quantity integer not null,
  adjustment_amount integer not null,
  resulting_quantity integer not null,
  reason text not null,
  adjusted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint blood_inventory_adjustments_previous_non_negative check (previous_quantity >= 0),
  constraint blood_inventory_adjustments_resulting_non_negative check (resulting_quantity >= 0),
  constraint blood_inventory_adjustments_amount_nonzero check (adjustment_amount <> 0),
  constraint blood_inventory_adjustments_math check (
    resulting_quantity = previous_quantity + adjustment_amount
  ),
  constraint blood_inventory_adjustments_reason_present check (
    char_length(trim(reason)) > 0
  )
);

create index if not exists blood_inventory_adjustments_inventory_created_idx
  on public.blood_inventory_adjustments (inventory_id, created_at desc);

create index if not exists blood_inventory_adjustments_actor_created_idx
  on public.blood_inventory_adjustments (adjusted_by, created_at desc);

-- ----------------------------------------------------------------------------
-- 3) Authorization helper (inventory scope)
-- ----------------------------------------------------------------------------
create or replace function public.can_manage_blood_inventory(p_bloodbank_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or (
        public.is_bloodbank_verified()
        and p_bloodbank_id = auth.uid()
      )
    );
$$;

revoke all on function public.can_manage_blood_inventory(uuid) from public;
revoke all on function public.can_manage_blood_inventory(uuid) from anon;
grant execute on function public.can_manage_blood_inventory(uuid) to authenticated;

comment on function public.can_manage_blood_inventory(uuid) is
  'True when caller is admin (any bank) or verified bloodbank managing their own inventory.';

create or replace function public.assert_bloodbank_inventory_target(p_bloodbank_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_bloodbank_id is null then
    raise exception 'Blood bank is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_bloodbank_id
      and p.role = 'bloodbank'
  ) then
    raise exception 'Inventory target must be a bloodbank profile'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.assert_bloodbank_inventory_target(uuid) from public;
revoke all on function public.assert_bloodbank_inventory_target(uuid) from anon;
-- Internal helper; callable by authenticated via DEFINER RPCs only is preferred,
-- but grant is harmless because it only raises / no-ops on checks.
grant execute on function public.assert_bloodbank_inventory_target(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------
alter table public.blood_inventory enable row level security;
alter table public.blood_inventory_adjustments enable row level security;

drop policy if exists "blood_inventory select admin or own verified" on public.blood_inventory;
create policy "blood_inventory select admin or own verified"
on public.blood_inventory
for select to authenticated
using (
  public.is_admin()
  or (
    public.is_bloodbank_verified()
    and bloodbank_id = auth.uid()
  )
);

-- No direct INSERT/UPDATE/DELETE policies — mutations go through RPCs.

drop policy if exists "blood_inventory_adjustments select admin or own verified"
  on public.blood_inventory_adjustments;
create policy "blood_inventory_adjustments select admin or own verified"
on public.blood_inventory_adjustments
for select to authenticated
using (
  public.is_admin()
  or (
    public.is_bloodbank_verified()
    and exists (
      select 1
      from public.blood_inventory bi
      where bi.id = blood_inventory_adjustments.inventory_id
        and bi.bloodbank_id = auth.uid()
    )
  )
);

-- ----------------------------------------------------------------------------
-- 5) RPCs
-- ----------------------------------------------------------------------------
create or replace function public.ensure_blood_inventory(p_bloodbank_id uuid)
returns setof public.blood_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.blood_type;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.can_manage_blood_inventory(p_bloodbank_id) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  perform public.assert_bloodbank_inventory_target(p_bloodbank_id);

  foreach v_type in array enum_range(null::public.blood_type)
  loop
    insert into public.blood_inventory (bloodbank_id, blood_type)
    values (p_bloodbank_id, v_type)
    on conflict (bloodbank_id, blood_type) do nothing;
  end loop;

  return query
  select *
  from public.blood_inventory
  where bloodbank_id = p_bloodbank_id
  order by blood_type;
end;
$$;

revoke all on function public.ensure_blood_inventory(uuid) from public;
revoke all on function public.ensure_blood_inventory(uuid) from anon;
grant execute on function public.ensure_blood_inventory(uuid) to authenticated;

comment on function public.ensure_blood_inventory(uuid) is
  'Ensures all eight canonical blood-type inventory rows exist for a bloodbank. Staff-only.';

create or replace function public.adjust_blood_inventory(
  p_bloodbank_id uuid,
  p_blood_type public.blood_type,
  p_delta integer,
  p_reason text
)
returns public.blood_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.blood_inventory;
  v_previous integer;
  v_next integer;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.can_manage_blood_inventory(p_bloodbank_id) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  perform public.assert_bloodbank_inventory_target(p_bloodbank_id);

  if p_delta is null or p_delta = 0 then
    raise exception 'Adjustment amount must be a non-zero integer'
      using errcode = '22023';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 then
    raise exception 'Adjustment reason is required'
      using errcode = '22023';
  end if;

  -- Ensure the row exists, then lock it for the atomic adjustment.
  insert into public.blood_inventory (bloodbank_id, blood_type)
  values (p_bloodbank_id, p_blood_type)
  on conflict (bloodbank_id, blood_type) do nothing;

  select *
  into v_row
  from public.blood_inventory
  where bloodbank_id = p_bloodbank_id
    and blood_type = p_blood_type
  for update;

  if not found then
    raise exception 'Inventory row not found'
      using errcode = 'P0002';
  end if;

  v_previous := v_row.quantity;
  v_next := v_previous + p_delta;

  if v_next < 0 then
    raise exception 'Insufficient stock: cannot reduce below zero'
      using errcode = '22023';
  end if;

  update public.blood_inventory
  set quantity = v_next
  where id = v_row.id
  returning * into v_row;

  insert into public.blood_inventory_adjustments (
    inventory_id,
    previous_quantity,
    adjustment_amount,
    resulting_quantity,
    reason,
    adjusted_by
  )
  values (
    v_row.id,
    v_previous,
    p_delta,
    v_next,
    v_reason,
    auth.uid()
  );

  return v_row;
end;
$$;

revoke all on function public.adjust_blood_inventory(uuid, public.blood_type, integer, text) from public;
revoke all on function public.adjust_blood_inventory(uuid, public.blood_type, integer, text) from anon;
grant execute on function public.adjust_blood_inventory(uuid, public.blood_type, integer, text) to authenticated;

comment on function public.adjust_blood_inventory(uuid, public.blood_type, integer, text) is
  'Atomically add/subtract inventory units with audit history. Rejects negative stock. Staff-only.';

create or replace function public.set_blood_inventory_thresholds(
  p_bloodbank_id uuid,
  p_blood_type public.blood_type,
  p_low_threshold integer,
  p_critical_threshold integer
)
returns public.blood_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.blood_inventory;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.can_manage_blood_inventory(p_bloodbank_id) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  perform public.assert_bloodbank_inventory_target(p_bloodbank_id);

  if p_low_threshold is null or p_critical_threshold is null then
    raise exception 'Thresholds are required'
      using errcode = '22023';
  end if;

  if p_low_threshold < 0 or p_critical_threshold < 0 then
    raise exception 'Thresholds cannot be negative'
      using errcode = '22023';
  end if;

  if p_critical_threshold > p_low_threshold then
    raise exception 'Critical threshold cannot exceed low threshold'
      using errcode = '22023';
  end if;

  insert into public.blood_inventory (bloodbank_id, blood_type)
  values (p_bloodbank_id, p_blood_type)
  on conflict (bloodbank_id, blood_type) do nothing;

  update public.blood_inventory
  set
    low_threshold = p_low_threshold,
    critical_threshold = p_critical_threshold
  where bloodbank_id = p_bloodbank_id
    and blood_type = p_blood_type
  returning * into v_row;

  if not found then
    raise exception 'Inventory row not found'
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_blood_inventory_thresholds(uuid, public.blood_type, integer, integer) from public;
revoke all on function public.set_blood_inventory_thresholds(uuid, public.blood_type, integer, integer) from anon;
grant execute on function public.set_blood_inventory_thresholds(uuid, public.blood_type, integer, integer) to authenticated;

comment on function public.set_blood_inventory_thresholds(uuid, public.blood_type, integer, integer) is
  'Update low/critical thresholds for a bloodbank blood type. Staff-only; status recomputed by generated column.';

-- Safe map/summary payload for staff dashboards (no donor/recipient PII).
create or replace function public.list_blood_inventory_sites()
returns table (
  bloodbank_id uuid,
  display_name text,
  organization_name text,
  hospital_name text,
  branch_location text,
  address text,
  latitude double precision,
  longitude double precision,
  total_units bigint,
  critical_count bigint,
  low_count bigint,
  stable_count bigint,
  stock jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not (public.is_admin() or public.is_bloodbank_verified()) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  return query
  with scoped as (
    select bi.*
    from public.blood_inventory bi
    where public.is_admin()
       or bi.bloodbank_id = auth.uid()
  ),
  agg as (
    select
      s.bloodbank_id,
      coalesce(sum(s.quantity), 0)::bigint as total_units,
      count(*) filter (where s.stock_status = 'critical')::bigint as critical_count,
      count(*) filter (where s.stock_status = 'low')::bigint as low_count,
      count(*) filter (where s.stock_status = 'stable')::bigint as stable_count,
      jsonb_object_agg(s.blood_type::text, s.quantity) as stock,
      jsonb_object_agg(s.blood_type::text, s.stock_status::text) as statuses
    from scoped s
    group by s.bloodbank_id
  )
  select
    a.bloodbank_id,
    coalesce(nullif(trim(bv.hospital_name), ''), nullif(trim(p.organization_name), ''), p.full_name) as display_name,
    p.organization_name,
    bv.hospital_name,
    bv.branch_location,
    p.address,
    p.latitude,
    p.longitude,
    a.total_units,
    a.critical_count,
    a.low_count,
    a.stable_count,
    jsonb_build_object(
      'quantities', a.stock,
      'statuses', a.statuses
    ) as stock
  from agg a
  join public.profiles p on p.id = a.bloodbank_id
  left join public.bloodbank_verifications bv
    on bv.profile_id = a.bloodbank_id
   and bv.status = 'approved'
  where p.role = 'bloodbank'
  order by display_name;
end;
$$;

revoke all on function public.list_blood_inventory_sites() from public;
revoke all on function public.list_blood_inventory_sites() from anon;
grant execute on function public.list_blood_inventory_sites() to authenticated;

comment on function public.list_blood_inventory_sites() is
  'Staff inventory map/summary sites. Admin: all banks. Verified bloodbank: own bank only.';

create or replace function public.get_blood_inventory_summary()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not (public.is_admin() or public.is_bloodbank_verified()) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  with scoped as (
    select bi.*
    from public.blood_inventory bi
    where public.is_admin()
       or bi.bloodbank_id = auth.uid()
  ),
  by_type as (
    select
      s.blood_type::text as blood_type,
      coalesce(sum(s.quantity), 0)::bigint as units,
      count(*) filter (where s.stock_status = 'critical')::bigint as critical_rows,
      count(*) filter (where s.stock_status = 'low')::bigint as low_rows
    from scoped s
    group by s.blood_type
  ),
  banks as (
    select
      s.bloodbank_id,
      bool_or(s.stock_status = 'critical') as has_critical,
      bool_or(s.stock_status = 'low') as has_low
    from scoped s
    group by s.bloodbank_id
  )
  select json_build_object(
    'total_units', (select coalesce(sum(quantity), 0) from scoped),
    'banks_tracked', (select count(*) from banks),
    'banks_with_critical', (select count(*) from banks where has_critical),
    'banks_with_low', (select count(*) from banks where has_low and not has_critical),
    'critical_rows', (select count(*) from scoped where stock_status = 'critical'),
    'low_rows', (select count(*) from scoped where stock_status = 'low'),
    'by_blood_type', coalesce(
      (select json_agg(row_to_json(bt) order by bt.blood_type) from by_type bt),
      '[]'::json
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_blood_inventory_summary() from public;
revoke all on function public.get_blood_inventory_summary() from anon;
grant execute on function public.get_blood_inventory_summary() to authenticated;

comment on function public.get_blood_inventory_summary() is
  'Aggregate inventory metrics for staff dashboards. Scoped by role.';

-- ----------------------------------------------------------------------------
-- 6) Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.blood_inventory;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.blood_inventory_adjustments;
exception
  when duplicate_object then null;
end;
$$;

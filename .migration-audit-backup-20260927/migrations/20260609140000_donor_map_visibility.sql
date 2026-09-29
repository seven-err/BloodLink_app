-- Donor opt-in map visibility and a safe nearby-donor lookup for the map screen.

alter table public.profiles
  add column if not exists visible_on_map boolean not null default false;

create or replace function public.enforce_donor_map_visibility_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.visible_on_map = true then
      if new.role <> 'donor' then
        raise exception 'Only donors can appear on the donor map.';
      end if;

      if new.latitude is null or new.longitude is null then
        raise exception 'Add a location to your profile before appearing on the donor map.';
      end if;

      if not public.is_donor_verification_active(new.id) then
        raise exception 'Verified donors can appear on the donor map after approval.';
      end if;
    end if;
  elsif new.visible_on_map is distinct from old.visible_on_map and new.visible_on_map = true then
    if new.role <> 'donor' then
      raise exception 'Only donors can appear on the donor map.';
    end if;

    if new.latitude is null or new.longitude is null then
      raise exception 'Add a location to your profile before appearing on the donor map.';
    end if;

    if not public.is_donor_verification_active(new.id) then
      raise exception 'Verified donors can appear on the donor map after approval.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_donor_map_visibility on public.profiles;

create trigger profiles_enforce_donor_map_visibility
before insert or update of visible_on_map on public.profiles
for each row execute function public.enforce_donor_map_visibility_guard();

create or replace function public.nearby_map_donors(
  origin_lat double precision,
  origin_lng double precision,
  radius_km double precision default 5,
  max_results integer default 50,
  filter_blood_type public.blood_type default null,
  available_only boolean default false
)
returns table (
  donor_id uuid,
  full_name text,
  blood_type public.blood_type,
  is_available boolean,
  latitude double precision,
  longitude double precision,
  donation_count bigint,
  last_donation_at timestamptz,
  is_verified boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography as point
  ),
  donor_stats as (
    select
      d.donor_id,
      count(*) filter (where d.status = 'completed') as donation_count,
      max(d.completed_at) filter (where d.status = 'completed') as last_donation_at
    from public.donations d
    group by d.donor_id
  )
  select
    p.id as donor_id,
    p.full_name,
    p.blood_type,
    p.is_available,
    round(p.latitude::numeric, 2)::double precision as latitude,
    round(p.longitude::numeric, 2)::double precision as longitude,
    coalesce(ds.donation_count, 0) as donation_count,
    coalesce(ds.last_donation_at, p.last_donation_at) as last_donation_at,
    public.is_donor_verification_active(p.id) as is_verified
  from public.profiles p
  cross join origin o
  left join donor_stats ds on ds.donor_id = p.id
  where p.role = 'donor'
    and p.visible_on_map = true
    and p.location is not null
    and p.id <> auth.uid()
    and public.is_donor_verification_active(p.id)
    and (filter_blood_type is null or p.blood_type = filter_blood_type)
    and (not available_only or p.is_available = true)
    and st_dwithin(p.location, o.point, greatest(radius_km, 0.1) * 1000)
  order by p.location <-> o.point
  limit greatest(1, least(max_results, 100));
$$;

revoke all on function public.nearby_map_donors(
  double precision,
  double precision,
  double precision,
  integer,
  public.blood_type,
  boolean
) from public;

grant execute on function public.nearby_map_donors(
  double precision,
  double precision,
  double precision,
  integer,
  public.blood_type,
  boolean
) to authenticated;

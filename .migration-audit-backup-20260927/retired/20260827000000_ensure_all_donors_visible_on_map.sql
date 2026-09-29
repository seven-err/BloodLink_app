-- Ensure all donors with locations appear on the map
alter table public.profiles
  alter column visible_on_map set default true;

-- Backfill existing donors so they are visible on map if they have location
update public.profiles
set visible_on_map = true
where role = 'donor'
  and location is not null;

create or replace function public.nearby_map_donors(
  origin_lat double precision,
  origin_lng double precision,
  radius_km double precision default 25,
  max_results integer default 100,
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
    p.latitude,
    p.longitude,
    coalesce(ds.donation_count, 0) as donation_count,
    coalesce(ds.last_donation_at, p.last_donation_at) as last_donation_at,
    public.is_donor_verification_active(p.id) as is_verified
  from public.profiles p
  cross join origin o
  left join donor_stats ds on ds.donor_id = p.id
  where p.role = 'donor'
    and coalesce(p.visible_on_map, true) = true
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

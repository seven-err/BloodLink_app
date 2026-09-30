-- Safe facility directory for authenticated BloodLink users.
-- Exposes only approved blood-bank display/location data; no staff identity or
-- verification-document fields are returned.

create or replace function public.list_verified_bloodbank_facilities()
returns table (
  bloodbank_id uuid,
  display_name text,
  branch_location text,
  address text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as bloodbank_id,
    coalesce(
      nullif(trim(bv.hospital_name), ''),
      nullif(trim(p.organization_name), ''),
      p.full_name
    ) as display_name,
    nullif(trim(bv.branch_location), '') as branch_location,
    nullif(trim(p.address), '') as address,
    p.latitude,
    p.longitude
  from public.bloodbank_verifications bv
  join public.profiles p on p.id = bv.profile_id
  where (select auth.uid()) is not null
    and bv.status = 'approved'
    and p.role = 'bloodbank'
  order by display_name, branch_location;
$$;

revoke all on function public.list_verified_bloodbank_facilities() from public;
revoke all on function public.list_verified_bloodbank_facilities() from anon;
grant execute on function public.list_verified_bloodbank_facilities() to authenticated;

comment on function public.list_verified_bloodbank_facilities() is
  'Authenticated facility picker directory containing approved blood-bank name and public location fields only.';

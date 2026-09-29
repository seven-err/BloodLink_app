-- Restrict full blood_requests reads; expose a limited donor feed for open requests.
-- Sensitive fields (requester_id, patient_name, hospital_name, contact_phone,
-- attachment_path, notes, address) remain on blood_requests and are readable only
-- by the requester, matched donors, admin, bloodbank, or elevated service context.

create or replace function public.is_bloodbank(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'bloodbank'
  );
$$;

create or replace function public.is_matched_donor_for_request(
  request_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donor_matches dm
    where dm.request_id = is_matched_donor_for_request.request_id
      and dm.donor_id = user_id
      and dm.status in ('pending', 'accepted', 'completed')
  );
$$;

drop policy if exists "blood requests select visible" on public.blood_requests;

create policy "blood requests select authorized" on public.blood_requests
for select to authenticated
using (
  requester_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank()
  or public.is_elevated_role_context()
  or public.is_matched_donor_for_request(id)
);

create or replace view public.open_blood_requests_feed
with (security_invoker = false)
as
select
  id,
  blood_type,
  units_needed,
  urgency,
  needed_at,
  latitude,
  longitude,
  created_at,
  updated_at
from public.blood_requests
where status = 'open';

grant select on public.open_blood_requests_feed to authenticated;

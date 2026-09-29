-- Ensure donors can respond to open blood requests (RLS insert policy).
-- Expose exact request location fields in the donor feed view.

create or replace function public.is_donor(user_id uuid default auth.uid())
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
      and role = 'donor'
  );
$$;

grant execute on function public.is_donor(uuid) to authenticated;

drop policy if exists "donor matches insert donor response" on public.donor_matches;

create policy "donor matches insert donor response" on public.donor_matches
for insert to authenticated
with check (
  donor_id = auth.uid()
  and public.is_donor(auth.uid())
  and exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.status = 'open'
  )
);

drop view if exists public.open_blood_requests_feed;

create view public.open_blood_requests_feed
with (security_invoker = false)
as
select
  id,
  blood_type,
  units_needed,
  urgency,
  needed_at,
  hospital_name,
  address,
  latitude,
  longitude,
  created_at,
  updated_at
from public.blood_requests
where status = 'open';

grant select on public.open_blood_requests_feed to authenticated;

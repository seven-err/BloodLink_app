-- Recipient-side donor match management: safe donor summary view and bloodbank access.
-- Exposes only donor name and blood type to authorized request owners (not full profiles).
-- Access is enforced in the view WHERE clause (Postgres does not support RLS policies on views).

create or replace view public.recipient_donor_match_responses
with (security_invoker = false)
as
select
  dm.id,
  dm.request_id,
  dm.donor_id,
  dm.status,
  dm.distance_meters,
  dm.travel_time_seconds,
  dm.responded_at,
  dm.created_at,
  dm.updated_at,
  p.full_name as donor_name,
  p.blood_type as donor_blood_type
from public.donor_matches dm
inner join public.profiles p on p.id = dm.donor_id and p.role = 'donor'
inner join public.blood_requests br on br.id = dm.request_id
where
  br.requester_id = (select auth.uid())
  or public.is_admin()
  or public.is_bloodbank()
  or public.is_elevated_role_context();

grant select on public.recipient_donor_match_responses to authenticated;

drop policy if exists "donor matches select involved admin" on public.donor_matches;

create policy "donor matches select involved admin bloodbank" on public.donor_matches
for select to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank()
  or exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

drop policy if exists "donor matches update involved admin" on public.donor_matches;

create policy "donor matches update involved admin bloodbank" on public.donor_matches
for update to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank()
  or exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
)
with check (
  donor_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank()
  or exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

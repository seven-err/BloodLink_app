-- Expose donor verification summary on recipient match responses (name + blood type only policy).

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
  p.blood_type as donor_blood_type,
  public.is_donor_verification_active(dm.donor_id) as donor_verification_active,
  (
    select dv.status
    from public.donor_verifications dv
    where dv.donor_id = dm.donor_id
    order by dv.created_at desc
    limit 1
  ) as donor_verification_status
from public.donor_matches dm
inner join public.profiles p on p.id = dm.donor_id and p.role = 'donor'
inner join public.blood_requests br on br.id = dm.request_id
where
  br.requester_id = (select auth.uid())
  or public.is_admin()
  or public.is_bloodbank()
  or public.is_elevated_role_context();

grant select on public.recipient_donor_match_responses to authenticated;

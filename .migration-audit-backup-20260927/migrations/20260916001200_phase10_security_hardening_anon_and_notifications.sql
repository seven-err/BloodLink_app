-- Phase 10: close CRITICAL/HIGH anonymous and notification abuse paths.
-- Does not invent new donor-verification UI; only removes leftover auto-approve
-- trigger that contradicts Phase 6 hardening intent and leaks privileges.

-- 1) create_app_notification must not be callable by clients.
-- Triggers and SECURITY DEFINER RPCs run as owner and retain access.
revoke all on function public.create_app_notification(uuid, public.notification_type, text, text, jsonb) from public;
revoke all on function public.create_app_notification(uuid, public.notification_type, text, text, jsonb) from anon;
revoke all on function public.create_app_notification(uuid, public.notification_type, text, text, jsonb) from authenticated;

-- 2) Nearby map donors: authenticated only + require signed-in caller.
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
  where auth.uid() is not null
    and p.role = 'donor'
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

revoke all on function public.nearby_map_donors(double precision, double precision, double precision, integer, public.blood_type, boolean) from public;
revoke all on function public.nearby_map_donors(double precision, double precision, double precision, integer, public.blood_type, boolean) from anon;
grant execute on function public.nearby_map_donors(double precision, double precision, double precision, integer, public.blood_type, boolean) to authenticated;

-- 3) SECURITY DEFINER views: revoke anonymous SELECT (keep authenticated).
revoke all on public.open_blood_requests_feed from public;
revoke all on public.open_blood_requests_feed from anon;
grant select on public.open_blood_requests_feed to authenticated;

revoke all on public.recipient_donor_match_responses from public;
revoke all on public.recipient_donor_match_responses from anon;
grant select on public.recipient_donor_match_responses to authenticated;

-- 4) Trigger-only / helper SECURITY DEFINER functions should not be RPC-callable.
revoke all on function public.auto_approve_new_donor() from public;
revoke all on function public.auto_approve_new_donor() from anon;
revoke all on function public.auto_approve_new_donor() from authenticated;

revoke all on function public.auto_verify_donor_on_profile() from public;
revoke all on function public.auto_verify_donor_on_profile() from anon;
revoke all on function public.auto_verify_donor_on_profile() from authenticated;

revoke all on function public.notify_donors_of_new_blood_request() from public;
revoke all on function public.notify_donors_of_new_blood_request() from anon;
revoke all on function public.notify_donors_of_new_blood_request() from authenticated;

revoke all on function public.notify_donor_of_match_status_change() from public;
revoke all on function public.notify_donor_of_match_status_change() from anon;
revoke all on function public.notify_donor_of_match_status_change() from authenticated;

revoke all on function public.notify_parties_of_donation_created() from public;
revoke all on function public.notify_parties_of_donation_created() from anon;
revoke all on function public.notify_parties_of_donation_created() from authenticated;

revoke all on function public.notify_recipient_of_donor_response() from public;
revoke all on function public.notify_recipient_of_donor_response() from anon;
revoke all on function public.notify_recipient_of_donor_response() from authenticated;

revoke all on function public.enforce_donation_token_immutable() from public;
revoke all on function public.enforce_donation_token_immutable() from anon;
revoke all on function public.enforce_donation_token_immutable() from authenticated;

revoke all on function public.enforce_donor_availability_guard() from public;
revoke all on function public.enforce_donor_availability_guard() from anon;
revoke all on function public.enforce_donor_availability_guard() from authenticated;

revoke all on function public.enforce_donor_map_visibility_guard() from public;
revoke all on function public.enforce_donor_map_visibility_guard() from anon;
revoke all on function public.enforce_donor_map_visibility_guard() from authenticated;

revoke all on function public.enforce_message_update_guard() from public;
revoke all on function public.enforce_message_update_guard() from anon;
revoke all on function public.enforce_message_update_guard() from authenticated;

revoke all on function public.enforce_profile_role_guard() from public;
revoke all on function public.enforce_profile_role_guard() from anon;
revoke all on function public.enforce_profile_role_guard() from authenticated;

revoke all on function public.ensure_notification_preferences() from public;
revoke all on function public.ensure_notification_preferences() from anon;
revoke all on function public.ensure_notification_preferences() from authenticated;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;

-- 5) Remove leftover donor auto-approve trigger (bypass). Keep table/model;
-- do not invent a staff review workflow here.
drop trigger if exists on_profile_created_auto_approve on public.profiles;
drop trigger if exists trigger_auto_verify_donor on public.profiles;

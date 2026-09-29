-- ============================================================================
-- BloodLink security hardening — prerequisites for the web admin console.
--
-- This migration hardens RLS / privilege boundaries BEFORE the web admin app
-- (Bloodlink_admin) begins reading production data. It addresses the seven
-- issues identified in the parity audit, standardises privileged access on
-- verified blood bank staff, and adds server-side RPCs for sensitive lifecycle
-- transitions so clients can no longer perform arbitrary status UPDATEs.
--
-- Design principles:
--   * The blood bank ROLE alone grants nothing. Privileged access requires an
--     APPROVED bloodbank_verifications row (public.is_bloodbank_verified()).
--     Self-assigning the bloodbank role during onboarding is still allowed so
--     staff can submit a verification, but it is inert until approved.
--   * Donors browse open requests through the limited open_blood_requests_feed
--     view (no patient name / contact / notes / requester_id). Full PHI rows are
--     readable only by the requester, matched donors, admins, verified staff, or
--     the service role.
--   * Sensitive lifecycle statuses (donor_matches.status, donations.status) can
--     no longer be set to arbitrary values by clients; they are constrained by
--     BEFORE triggers and driven by SECURITY DEFINER RPCs.
--
-- Idempotent: safe to re-run (drop-if-exists + create-or-replace throughout).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ISSUE 3 (+2): Unverified blood bank privileges.
-- Ensure the authoritative helper exists (defined in 20260608161830); recreated
-- here defensively so this migration is self-contained.
-- ----------------------------------------------------------------------------
create or replace function public.is_bloodbank_verified(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bloodbank_verifications bv
    join public.profiles p on p.id = bv.profile_id
    where bv.profile_id = user_id
      and p.role = 'bloodbank'
      and bv.status = 'approved'
  );
$$;

grant execute on function public.is_bloodbank_verified(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- ISSUE 1: Open blood_requests full-PHI exposure.
-- Migration 20260816170000 re-added `status = 'open'` to the full-table SELECT
-- policy, exposing patient_name / contact_phone / notes / requester_id /
-- attachment_path to every authenticated user. Remove that blanket exposure.
-- Donors use open_blood_requests_feed (PHI-free) to browse; full rows require a
-- legitimate relationship. Also upgrade is_bloodbank() -> is_bloodbank_verified().
--
-- NOTE: the notify_donors_of_new_blood_request trigger from 20260816170000 is
-- intentionally left in place. Realtime/full-row access for donors is replaced
-- by the feed view + notifications, matching the pre-20260816170000 design.
-- ----------------------------------------------------------------------------
drop policy if exists "blood requests select authorized" on public.blood_requests;
drop policy if exists "blood requests select visible" on public.blood_requests;

create policy "blood requests select authorized" on public.blood_requests
for select to authenticated
using (
  requester_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank_verified()
  or public.is_elevated_role_context()
  or public.is_matched_donor_for_request(id)
);

grant select on public.open_blood_requests_feed to authenticated;

-- ----------------------------------------------------------------------------
-- ISSUE 3: donor_matches access via unverified blood bank.
-- Rebuild SELECT/UPDATE policies to require VERIFIED blood bank staff.
-- ----------------------------------------------------------------------------
drop policy if exists "donor matches select involved admin bloodbank" on public.donor_matches;
drop policy if exists "donor matches select involved admin" on public.donor_matches;

create policy "donor matches select involved admin bloodbank" on public.donor_matches
for select to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank_verified()
  or exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

drop policy if exists "donor matches update involved admin bloodbank" on public.donor_matches;
drop policy if exists "donor matches update involved admin" on public.donor_matches;

create policy "donor matches update involved admin bloodbank" on public.donor_matches
for update to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank_verified()
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
  or public.is_bloodbank_verified()
  or exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

-- Recipient donor-match summary view: verified staff only (was is_bloodbank()).
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
  or public.is_bloodbank_verified()
  or public.is_elevated_role_context();

grant select on public.recipient_donor_match_responses to authenticated;

-- ----------------------------------------------------------------------------
-- ISSUE 5: Broad donor_matches status updates.
-- RLS grants row access; this trigger constrains WHICH transitions each actor
-- may perform, and freezes identity columns for non-privileged actors.
--
-- Allowed transitions (canonical donor_match_status):
--   Donor (donor_id = auth.uid()):
--       pending  -> accepted | declined
--       accepted -> cancelled
--   Requester (owner of the blood_request):
--       pending | accepted -> cancelled
--   Verified blood bank staff:
--       accepted -> completed | cancelled
--   Admin / service role: unrestricted.
-- 'completed' is never client-settable by donor/requester; it flows from the
-- donation-completion RPC or verified staff.
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER (default) is REQUIRED here: the guard must observe the real
-- caller. A SECURITY DEFINER trigger would run as its owner (postgres), making
-- is_elevated_role_context() always true and silently bypassing enforcement.
-- Under INVOKER: normal client updates run as `authenticated` (guard active);
-- updates nested inside SECURITY DEFINER RPCs / service-role / direct psql run in
-- an elevated context and are (correctly) allowed through.
create or replace function public.enforce_donor_match_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_elevated_role_context() or public.is_admin() then
    return new;
  end if;

  -- Identity / provenance columns are immutable for non-privileged actors.
  if new.request_id is distinct from old.request_id
     or new.donor_id is distinct from old.donor_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot modify donor match identity columns'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if auth.uid() = old.donor_id then
      if not (
        (old.status = 'pending' and new.status in ('accepted', 'declined'))
        or (old.status = 'accepted' and new.status = 'cancelled')
      ) then
        raise exception 'Donor cannot change match status from % to %', old.status, new.status
          using errcode = '42501';
      end if;
    elsif exists (
      select 1 from public.blood_requests br
      where br.id = old.request_id and br.requester_id = auth.uid()
    ) then
      if not (old.status in ('pending', 'accepted') and new.status = 'cancelled') then
        raise exception 'Requester cannot change match status from % to %', old.status, new.status
          using errcode = '42501';
      end if;
    elsif public.is_bloodbank_verified() then
      if not (old.status = 'accepted' and new.status in ('completed', 'cancelled')) then
        raise exception 'Staff cannot change match status from % to %', old.status, new.status
          using errcode = '42501';
      end if;
    else
      raise exception 'Unauthorized donor match status change'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists donor_matches_enforce_update_guard on public.donor_matches;

create trigger donor_matches_enforce_update_guard
before update on public.donor_matches
for each row execute function public.enforce_donor_match_update_guard();

-- ----------------------------------------------------------------------------
-- ISSUE 4: Donor auto-verify bypass (20260816130000).
--   (a) is_donor_verification_active() had been weakened to a role-only check,
--       so it returned TRUE for any donor even if rejected/expired/unreviewed.
--       Restore an honest check against approved, unexpired verification rows.
--   (b) Remove the trigger that auto-approves EVERY donor on signup. New donors
--       are now 'pending' until reviewed. Existing (already backfilled) approved
--       rows are intentionally left intact so current donors are not disrupted.
-- ----------------------------------------------------------------------------
create or replace function public.is_donor_verification_active(donor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donor_verifications dv
    join public.profiles p on p.id = dv.donor_id
    where dv.donor_id = is_donor_verification_active.donor_id
      and p.role = 'donor'
      and dv.status = 'approved'
      and (dv.expires_at is null or dv.expires_at > now())
  );
$$;

-- Stop force-approving donors on profile insert/update.
drop trigger if exists trigger_auto_verify_donor on public.profiles;

-- ----------------------------------------------------------------------------
-- ISSUE 6: QR verification_token exposure on donations SELECT.
-- The token let anyone with row access (incl. the recipient/requester) read the
-- donor's secret and forge a QR. Remove the token from column-level SELECT for
-- authenticated users; the owning donor fetches it through a dedicated RPC, and
-- staff verify/complete via SECURITY DEFINER RPCs (below).
-- ----------------------------------------------------------------------------
revoke select (verification_token) on public.donations from authenticated;

-- Re-grant SELECT on every OTHER column so column-list selects keep working.
grant select (
  id, match_id, donor_id, request_id, status, scheduled_at, completed_at,
  units_donated, notes, created_at, updated_at
) on public.donations to authenticated;

-- Owning donor fetches their token (for QR rendering) via this RPC only.
create or replace function public.get_donation_qr_token(p_donation_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  select d.verification_token
  into v_token
  from public.donations d
  where d.id = p_donation_id
    and d.donor_id = auth.uid();

  if not found then
    raise exception 'Donation not found or access denied'
      using errcode = '42501';
  end if;

  return v_token;
end;
$$;

revoke all on function public.get_donation_qr_token(uuid) from public;
grant execute on function public.get_donation_qr_token(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- ISSUE 6 / QR verification: upgrade verify_donation_qr to require VERIFIED
-- blood bank staff (was role-only is_bloodbank()).
-- ----------------------------------------------------------------------------
create or replace function public.verify_donation_qr(
  p_donation_id uuid,
  p_token text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation public.donations;
begin
  if not (public.is_admin() or public.is_bloodbank_verified()) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    return json_build_object('valid', false);
  end if;

  select *
  into v_donation
  from public.donations
  where id = p_donation_id
    and verification_token = p_token;

  if not found then
    return json_build_object('valid', false);
  end if;

  return json_build_object(
    'valid', true,
    'donation_id', v_donation.id,
    'donation_status', v_donation.status,
    'match_id', v_donation.match_id,
    'donor_id', v_donation.donor_id,
    'request_id', v_donation.request_id
  );
end;
$$;

revoke all on function public.verify_donation_qr(uuid, text) from public;
grant execute on function public.verify_donation_qr(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- ISSUE 7: Weak messages INSERT (only sender_id check).
-- Previously any user could message any other user. Restrict inserts to matched
-- donor <-> requester pairs, plus admins and verified staff.
-- ----------------------------------------------------------------------------
create or replace function public.users_share_request_context(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donor_matches dm
    join public.blood_requests br on br.id = dm.request_id
    where (dm.donor_id = a and br.requester_id = b)
       or (dm.donor_id = b and br.requester_id = a)
  );
$$;

grant execute on function public.users_share_request_context(uuid, uuid) to authenticated;

drop policy if exists "messages insert sender" on public.messages;

create policy "messages insert sender" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    public.is_admin()
    or public.is_bloodbank_verified()
    or public.users_share_request_context(sender_id, recipient_id)
  )
);

-- ----------------------------------------------------------------------------
-- STEP 7: Secure lifecycle-transition RPCs.
-- These give clients an explicit, auditable API for sensitive transitions
-- instead of arbitrary UPDATEs.
-- ----------------------------------------------------------------------------

-- Donor accept/decline and requester/donor cancel. SECURITY INVOKER so RLS and
-- the enforce_donor_match_update_guard trigger apply for authorization.
create or replace function public.set_donor_match_status(
  p_match_id uuid,
  p_status public.donor_match_status
)
returns public.donor_matches
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.donor_matches;
begin
  update public.donor_matches
  set status = p_status,
      responded_at = case
        when p_status in ('accepted', 'declined') then now()
        else responded_at
      end
  where id = p_match_id
  returning * into v_row;

  if not found then
    raise exception 'Match not found or access denied'
      using errcode = '42501';
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_donor_match_status(uuid, public.donor_match_status) to authenticated;

-- Authorized donation completion after a QR scan. Verifies the token, requires
-- admin/verified staff, marks the donation 'completed' (NO 'verified' status is
-- introduced), and completes the linked match. SECURITY DEFINER.
create or replace function public.complete_verified_donation(
  p_donation_id uuid,
  p_token text,
  p_units_donated integer default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donation public.donations;
begin
  if not (public.is_admin() or public.is_bloodbank_verified()) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'A verification token is required'
      using errcode = '22023';
  end if;

  select *
  into v_donation
  from public.donations
  where id = p_donation_id
    and verification_token = p_token;

  if not found then
    return json_build_object('success', false, 'reason', 'invalid_token');
  end if;

  if v_donation.status = 'completed' then
    return json_build_object(
      'success', true,
      'already_completed', true,
      'donation_id', v_donation.id,
      'donation_status', v_donation.status,
      'match_id', v_donation.match_id
    );
  end if;

  if v_donation.status <> 'scheduled' then
    raise exception 'Donation is % and cannot be completed', v_donation.status
      using errcode = '22023';
  end if;

  update public.donations
  set status = 'completed',
      completed_at = now(),
      units_donated = coalesce(p_units_donated, units_donated),
      notes = coalesce(p_notes, notes)
  where id = v_donation.id
  returning * into v_donation;

  update public.donor_matches
  set status = 'completed'
  where id = v_donation.match_id
    and status <> 'completed';

  return json_build_object(
    'success', true,
    'donation_id', v_donation.id,
    'donation_status', v_donation.status,
    'match_id', v_donation.match_id
  );
end;
$$;

revoke all on function public.complete_verified_donation(uuid, text, integer, text) from public;
grant execute on function public.complete_verified_donation(uuid, text, integer, text) to authenticated;

-- Phase 4: Staff Donations Management (web admin).
--
-- Goals:
--   * Verified bloodbank + admin can SELECT donation rows (non-token columns).
--   * Controlled staff transitions: scheduled → cancelled | no_show.
--   * Completion remains QR-only via complete_verified_donation (Phase 5).
--   * Block arbitrary client UPDATEs of donation status / identity columns.
--   * Enable Realtime on donations for staff list freshness.
--
-- Does NOT:
--   * Introduce a 'verified' donation status.
--   * Expose verification_token.
--   * Allow staff to mark donations completed without QR.
--   * Create web-only donation records.

-- ----------------------------------------------------------------------------
-- 1) Staff SELECT access (parity with blood_requests / donor_matches).
-- ----------------------------------------------------------------------------
drop policy if exists "donations select involved admin" on public.donations;
drop policy if exists "donations select involved admin bloodbank" on public.donations;

create policy "donations select involved admin bloodbank" on public.donations
for select to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank_verified()
  or exists (
    select 1
    from public.blood_requests br
    where br.id = donations.request_id
      and br.requester_id = auth.uid()
  )
);

-- Keep INSERT as-is (donor/admin/requester). Staff do not invent donations;
-- mobile/backend ensure_donation_for_accepted_match creates them.

-- UPDATE: do not broaden bloodbank direct UPDATE. Staff status changes go
-- through set_donation_status / complete_verified_donation (SECURITY DEFINER).

-- ----------------------------------------------------------------------------
-- 2) Guard arbitrary status / identity UPDATEs.
-- SECURITY INVOKER so SECURITY DEFINER RPCs (owner = postgres) pass via
-- is_elevated_role_context(); normal clients cannot set status freely.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_donation_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_elevated_role_context() or public.is_admin() then
    return new;
  end if;

  if new.match_id is distinct from old.match_id
     or new.donor_id is distinct from old.donor_id
     or new.request_id is distinct from old.request_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot modify donation identity columns'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Donation status changes must use authorized RPCs'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists donations_enforce_update_guard on public.donations;

create trigger donations_enforce_update_guard
before update on public.donations
for each row execute function public.enforce_donation_update_guard();

-- ----------------------------------------------------------------------------
-- 3) Staff pre-QR status actions only: cancelled / no_show from scheduled.
-- Completion stays on complete_verified_donation (requires QR token).
-- Returns safe JSON — never includes verification_token.
-- ----------------------------------------------------------------------------
drop function if exists public.set_donation_status(uuid, public.donation_status);

create or replace function public.set_donation_status(
  p_donation_id uuid,
  p_status public.donation_status
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.donations;
  v_current public.donation_status;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not (public.is_admin() or public.is_bloodbank_verified()) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  -- Never allow completion through this RPC (QR workflow owns that).
  if p_status = 'completed' then
    raise exception 'Donation completion requires QR verification'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.donations
  where id = p_donation_id
  for update;

  if not found then
    raise exception 'Donation not found'
      using errcode = 'P0002';
  end if;

  v_current := v_row.status;

  if v_current <> p_status then
    if not (
      v_current = 'scheduled'
      and p_status in ('cancelled', 'no_show')
    ) then
      raise exception 'Invalid status transition from % to %', v_current, p_status
        using errcode = '22023';
    end if;

    update public.donations
    set status = p_status
    where id = p_donation_id
    returning * into v_row;
  end if;

  -- Never return verification_token to clients.
  return json_build_object(
    'id', v_row.id,
    'match_id', v_row.match_id,
    'donor_id', v_row.donor_id,
    'request_id', v_row.request_id,
    'status', v_row.status,
    'scheduled_at', v_row.scheduled_at,
    'completed_at', v_row.completed_at,
    'units_donated', v_row.units_donated,
    'notes', v_row.notes,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.set_donation_status(uuid, public.donation_status) from public;
revoke all on function public.set_donation_status(uuid, public.donation_status) from anon;
grant execute on function public.set_donation_status(uuid, public.donation_status) to authenticated;

comment on function public.set_donation_status(uuid, public.donation_status) is
  'Staff-only (admin or verified bloodbank) pre-QR donation transitions: scheduled → cancelled | no_show. Completion requires complete_verified_donation.';

-- ----------------------------------------------------------------------------
-- 4) Realtime for staff list freshness (idempotent).
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.donations;
exception
  when duplicate_object then
    null;
end;
$$;

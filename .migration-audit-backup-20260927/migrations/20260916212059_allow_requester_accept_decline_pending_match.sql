-- Allow the owner of a blood request to accept or decline a pending donor response.
-- The 20260915 update guard only let requesters cancel, so Accept on Request Details
-- raised: Requester cannot change match status from pending to accepted.
--
-- SECURITY INVOKER is required. A SECURITY DEFINER trigger would run as its owner
-- and make is_elevated_role_context() true, bypassing this guard.
--
-- Allowed transitions:
--   Donor (donor_id = auth.uid()):
--       pending  -> declined          (withdraw own response)
--       accepted -> cancelled
--       NOT pending -> accepted       (cannot accept their own match)
--   Requester (blood_requests.requester_id = auth.uid() for this match only):
--       pending  -> accepted | declined | cancelled
--       accepted -> cancelled
--   Verified blood bank staff:
--       accepted -> completed | cancelled
--   Admin / elevated role: unrestricted.
-- 'completed' is still not client-settable by donor or requester.

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
        (old.status = 'pending' and new.status = 'declined')
        or (old.status = 'accepted' and new.status = 'cancelled')
      ) then
        raise exception 'Donor cannot change match status from % to %', old.status, new.status
          using errcode = '42501';
      end if;
    elsif exists (
      select 1 from public.blood_requests br
      where br.id = old.request_id and br.requester_id = auth.uid()
    ) then
      if not (
        (old.status = 'pending' and new.status in ('accepted', 'declined', 'cancelled'))
        or (old.status = 'accepted' and new.status = 'cancelled')
      ) then
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

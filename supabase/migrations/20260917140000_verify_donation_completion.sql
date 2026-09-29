-- A donation is completed only by QR verification (complete_verified_donation).
-- A match status of "completed" is not proof of donation. Block client updates
-- that mark a match or donation completed without that RPC, then record the
-- verified outcome: notify both parties, sync the donor's last donation date,
-- and fulfill the request only when verified units cover what was requested.

create or replace function public.enforce_donation_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status = 'completed'
     and not public.is_elevated_role_context()
  then
    raise exception 'Donation completion requires QR verification'
      using errcode = '42501';
  end if;

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

create or replace function public.enforce_donor_match_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Completion is reserved for complete_verified_donation (SECURITY DEFINER /
  -- elevated context). Admins and staff cannot skip QR verification.
  if new.status is distinct from old.status
     and new.status = 'completed'
     and not public.is_elevated_role_context()
  then
    raise exception 'A match can be completed only after QR-verified donation completion'
      using errcode = '42501';
  end if;

  if public.is_elevated_role_context() or public.is_admin() then
    return new;
  end if;

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
      if not (old.status = 'accepted' and new.status = 'cancelled') then
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

create or replace function public.record_verified_donation_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.blood_requests;
  v_units integer;
  v_fulfilled boolean := false;
  v_completed_at timestamptz;
  v_body text;
begin
  if tg_op <> 'UPDATE'
     or old.status is not distinct from new.status
     or new.status <> 'completed'
  then
    return new;
  end if;

  v_completed_at := coalesce(new.completed_at, now());

  if new.completed_at is null then
    update public.donations
    set completed_at = v_completed_at
    where id = new.id
      and completed_at is null;
  end if;

  update public.donor_matches
  set status = 'completed'
  where id = new.match_id
    and status is distinct from 'completed';

  update public.profiles
  set last_donation_at = v_completed_at::date
  where id = new.donor_id
    and (
      last_donation_at is null
      or last_donation_at < v_completed_at::date
    );

  select *
  into v_request
  from public.blood_requests
  where id = new.request_id;

  if not found then
    perform public.create_app_notification(
      new.donor_id,
      'donation',
      'Donation verified',
      'Collection staff verified this donation by QR. It is recorded as completed.',
      jsonb_build_object(
        'related_request_id', new.request_id,
        'related_match_id', new.match_id,
        'related_donation_id', new.id
      )
    );

    return new;
  end if;

  select coalesce(sum(coalesce(d.units_donated, 1)), 0)::integer
  into v_units
  from public.donations d
  where d.request_id = new.request_id
    and d.status = 'completed';

  if v_request.status in ('open', 'matched')
     and v_units >= v_request.units_needed
  then
    update public.blood_requests
    set status = 'fulfilled'
    where id = v_request.id
      and status in ('open', 'matched');

    v_fulfilled := found;
  end if;

  v_body := case
    when v_fulfilled then
      'Collection staff verified this donation. The blood request is now fulfilled.'
    else
      'Collection staff verified this donation by QR. It is recorded as completed.'
  end;

  perform public.create_app_notification(
    new.donor_id,
    'donation',
    'Donation verified',
    v_body,
    jsonb_build_object(
      'related_request_id', new.request_id,
      'related_match_id', new.match_id,
      'related_donation_id', new.id
    )
  );

  if v_request.requester_id is not null and v_request.requester_id is distinct from new.donor_id then
    perform public.create_app_notification(
      v_request.requester_id,
      'donation',
      'Donation verified',
      v_body,
      jsonb_build_object(
        'related_request_id', new.request_id,
        'related_match_id', new.match_id,
        'related_donation_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists donations_record_verified_completion on public.donations;

create trigger donations_record_verified_completion
after update of status on public.donations
for each row execute function public.record_verified_donation_completion();

revoke all on function public.record_verified_donation_completion() from public;
revoke all on function public.record_verified_donation_completion() from anon;
revoke all on function public.record_verified_donation_completion() from authenticated;

comment on function public.record_verified_donation_completion() is
  'After QR verification marks a donation completed, complete the match, record last donation date, fulfill the request when verified units are enough, and notify both parties.';

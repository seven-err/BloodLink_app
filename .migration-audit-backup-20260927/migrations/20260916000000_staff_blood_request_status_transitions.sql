-- Phase 2: secure staff blood_request status transitions.
-- Staff (admin + verified bloodbank) must not perform arbitrary UPDATEs of
-- blood_requests from the web client. This RPC validates lifecycle transitions
-- and authorizes callers at the database layer.

create or replace function public.set_blood_request_status(
  p_request_id uuid,
  p_status public.blood_request_status
)
returns public.blood_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.blood_requests;
  v_current public.blood_request_status;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not (public.is_admin() or public.is_bloodbank_verified()) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  select *
  into v_row
  from public.blood_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found'
      using errcode = 'P0002';
  end if;

  v_current := v_row.status;

  if v_current = p_status then
    return v_row;
  end if;

  -- Canonical staff transitions only. Terminal states cannot be reopened.
  if not (
    (v_current = 'draft' and p_status in ('open', 'cancelled'))
    or (v_current = 'open' and p_status in ('matched', 'cancelled', 'expired'))
    or (v_current = 'matched' and p_status in ('fulfilled', 'cancelled'))
  ) then
    raise exception 'Invalid status transition from % to %', v_current, p_status
      using errcode = '22023';
  end if;

  update public.blood_requests
  set status = p_status
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_blood_request_status(uuid, public.blood_request_status) from public;
grant execute on function public.set_blood_request_status(uuid, public.blood_request_status) to authenticated;

comment on function public.set_blood_request_status(uuid, public.blood_request_status) is
  'Staff-only (admin or verified bloodbank) blood_request lifecycle transitions with validated status graph.';

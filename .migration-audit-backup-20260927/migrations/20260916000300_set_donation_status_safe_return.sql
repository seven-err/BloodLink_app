-- Harden set_donation_status return payload: never include verification_token.
-- Previous Phase 4 migration returned public.donations (full row).

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
  'Staff-only (admin or verified bloodbank) pre-QR donation transitions: scheduled → cancelled | no_show. Returns safe JSON without verification_token.';

-- Phase 6: admin-only blood bank verification review RPC + realtime queue.
-- Frontend must not be the authority for approve/reject transitions.

create or replace function public.review_bloodbank_verification(
  p_verification_id uuid,
  p_status public.bloodbank_verification_status,
  p_notes text default null
)
returns public.bloodbank_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bloodbank_verifications;
  v_notes text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid review status %', p_status
      using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if p_status = 'rejected' and v_notes is null then
    raise exception 'Rejection reason is required'
      using errcode = '22023';
  end if;

  select *
    into v_row
    from public.bloodbank_verifications
   where id = p_verification_id
   for update;

  if not found then
    raise exception 'Verification not found'
      using errcode = 'P0002';
  end if;

  if v_row.status is distinct from 'pending' then
    raise exception 'Invalid status transition from % to %', v_row.status, p_status
      using errcode = '22023';
  end if;

  update public.bloodbank_verifications
     set status = p_status,
         notes = case when p_status = 'rejected' then v_notes else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_verification_id
   returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.review_bloodbank_verification(
  uuid,
  public.bloodbank_verification_status,
  text
) from public;
revoke all on function public.review_bloodbank_verification(
  uuid,
  public.bloodbank_verification_status,
  text
) from anon;
grant execute on function public.review_bloodbank_verification(
  uuid,
  public.bloodbank_verification_status,
  text
) to authenticated;

comment on function public.review_bloodbank_verification(
  uuid,
  public.bloodbank_verification_status,
  text
) is
  'Admin-only pending→approved|rejected blood bank verification review with reviewer audit fields.';

-- Realtime queue updates for admin verification UI (RLS still filters rows).
do $$
begin
  alter publication supabase_realtime add table public.bloodbank_verifications;
exception
  when duplicate_object then
    null;
end;
$$;

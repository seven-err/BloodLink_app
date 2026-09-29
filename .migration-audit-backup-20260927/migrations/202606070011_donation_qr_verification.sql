-- Donation QR verification: secure token column and server-side helpers.
-- Mobile donors generate QR codes from donation_id + verification_token only.
-- Bloodbank/admin staff verify scans via verify_donation_qr (web dashboard later).

alter table public.donations
add column if not exists verification_token text;

update public.donations
set verification_token = encode(extensions.gen_random_bytes(32), 'hex')
where verification_token is null;

alter table public.donations
alter column verification_token set default encode(extensions.gen_random_bytes(32), 'hex'),
alter column verification_token set not null;

create unique index if not exists donations_verification_token_idx
on public.donations (verification_token);

create or replace function public.enforce_donation_token_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.verification_token is distinct from new.verification_token
    and not public.is_admin()
    and not public.is_elevated_role_context()
  then
    new.verification_token := old.verification_token;
  end if;

  return new;
end;
$$;

drop trigger if exists donations_enforce_token_immutable on public.donations;

create trigger donations_enforce_token_immutable
before update on public.donations
for each row execute function public.enforce_donation_token_immutable();

create or replace function public.ensure_donation_for_accepted_match(p_match_id uuid)
returns public.donations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.donor_matches;
  v_donation public.donations;
begin
  select *
  into v_match
  from public.donor_matches
  where id = p_match_id
    and donor_id = auth.uid();

  if not found then
    raise exception 'Match not found or access denied'
      using errcode = '42501';
  end if;

  if v_match.status not in ('accepted', 'completed') then
    raise exception 'Donation QR is available only for accepted matches'
      using errcode = '22023';
  end if;

  select *
  into v_donation
  from public.donations
  where match_id = p_match_id;

  if found then
    return v_donation;
  end if;

  insert into public.donations (match_id, donor_id, request_id, status)
  values (v_match.id, v_match.donor_id, v_match.request_id, 'scheduled')
  returning * into v_donation;

  return v_donation;
end;
$$;

revoke all on function public.ensure_donation_for_accepted_match(uuid) from public;
grant execute on function public.ensure_donation_for_accepted_match(uuid) to authenticated;

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
  if not (public.is_admin() or public.is_bloodbank()) then
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

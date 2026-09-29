-- Stop repeated blood-request posts from flooding compatible donors.
-- Recipients and donors must wait 10 minutes between creates. Admins, blood
-- banks, and service-role jobs are exempt so staff can post for multiple patients.

create index if not exists blood_requests_requester_created_idx
  on public.blood_requests (requester_id, created_at desc);

create or replace function public.blood_request_cooldown_remaining_seconds(
  p_requester_id uuid default auth.uid()
)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if p_requester_id is null
    or public.is_elevated_role_context()
    or public.is_admin()
    or public.is_bloodbank() then
    return 0;
  end if;

  if p_requester_id is distinct from auth.uid() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  select max(br.created_at)
  into v_last
  from public.blood_requests br
  where br.requester_id = p_requester_id
    and br.created_at > now() - interval '10 minutes';

  if v_last is null then
    return 0;
  end if;

  return greatest(
    0,
    ceil(extract(epoch from (v_last + interval '10 minutes' - now())))::integer
  );
end;
$$;

revoke all on function public.blood_request_cooldown_remaining_seconds(uuid) from public;
revoke all on function public.blood_request_cooldown_remaining_seconds(uuid) from anon;
grant execute on function public.blood_request_cooldown_remaining_seconds(uuid) to authenticated;

comment on function public.blood_request_cooldown_remaining_seconds(uuid) is
  'Seconds until the signed-in requester can create another blood request. Staff and service role return 0.';

create or replace function public.enforce_blood_request_cooldown()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_remaining integer;
  v_minutes integer;
begin
  if auth.uid() is null or public.is_elevated_role_context() then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('blood_request_cooldown:' || new.requester_id::text, 0)
  );

  v_remaining := public.blood_request_cooldown_remaining_seconds(new.requester_id);

  if v_remaining > 0 then
    v_minutes := greatest(1, ceil(v_remaining / 60.0)::integer);
    raise exception using
      errcode = 'P0001',
      message = format(
        'Please wait before creating another blood request. Try again in %s minute%s.',
        v_minutes,
        case when v_minutes = 1 then '' else 's' end
      );
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_blood_request_cooldown() from public;
revoke all on function public.enforce_blood_request_cooldown() from anon;
grant execute on function public.enforce_blood_request_cooldown() to authenticated;

drop trigger if exists blood_requests_enforce_create_cooldown on public.blood_requests;

create trigger blood_requests_enforce_create_cooldown
before insert on public.blood_requests
for each row execute function public.enforce_blood_request_cooldown();

-- created_at is the cooldown clock. Owners must not move it backward to retry early.
create or replace function public.protect_blood_request_created_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.created_at is distinct from old.created_at
    and not public.is_elevated_role_context()
    and not public.is_admin() then
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_blood_request_created_at() from public;
revoke all on function public.protect_blood_request_created_at() from anon;
grant execute on function public.protect_blood_request_created_at() to authenticated;

drop trigger if exists blood_requests_protect_created_at on public.blood_requests;

create trigger blood_requests_protect_created_at
before update on public.blood_requests
for each row execute function public.protect_blood_request_created_at();

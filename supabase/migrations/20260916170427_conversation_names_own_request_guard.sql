-- Chat counterpart names, per-user archive/delete, and own-request donate/chat guards.
--
-- Donors cannot read other users' profiles (RLS), so conversation titles fell back
-- to hospital or phone. conversation_counterparts is a security-definer view that
-- returns only the other participant's display name for accepted matches.
--
-- Donors must not donate to or message a request they created. The feed hides
-- those rows, and donor_matches insert is rejected server-side.

create or replace function public.is_own_blood_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blood_requests br
    where br.id = p_request_id
      and br.requester_id = auth.uid()
  );
$$;

revoke all on function public.is_own_blood_request(uuid) from public;
revoke all on function public.is_own_blood_request(uuid) from anon;
grant execute on function public.is_own_blood_request(uuid) to authenticated;

create or replace function public.users_share_request_context(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is distinct from b
    and exists (
      select 1
      from public.donor_matches dm
      join public.blood_requests br on br.id = dm.request_id
      where dm.donor_id <> br.requester_id
        and (
          (dm.donor_id = a and br.requester_id = b)
          or (dm.donor_id = b and br.requester_id = a)
        )
    );
$$;

revoke all on function public.users_share_request_context(uuid, uuid) from public;
revoke all on function public.users_share_request_context(uuid, uuid) from anon;
grant execute on function public.users_share_request_context(uuid, uuid) to authenticated;

drop policy if exists "donor matches insert donor response" on public.donor_matches;

create policy "donor matches insert donor response" on public.donor_matches
for insert to authenticated
with check (
  donor_id = auth.uid()
  and public.is_donor(auth.uid())
  and public.is_open_blood_request(request_id)
  and not public.is_own_blood_request(request_id)
);

create or replace view public.open_blood_requests_feed
with (security_invoker = false)
as
select
  id,
  blood_type,
  units_needed,
  urgency,
  needed_at,
  hospital_name,
  address,
  latitude,
  longitude,
  created_at,
  updated_at
from public.blood_requests
where status = 'open'
  and requester_id is distinct from auth.uid();

revoke all on public.open_blood_requests_feed from public;
revoke all on public.open_blood_requests_feed from anon;
grant select on public.open_blood_requests_feed to authenticated;

create or replace view public.conversation_counterparts
with (security_invoker = false)
as
select
  dm.id as donor_match_id,
  dm.request_id as blood_request_id,
  case
    when dm.donor_id = auth.uid() then br.requester_id
    else dm.donor_id
  end as other_party_id,
  coalesce(
    case
      when counterpart.role = 'bloodbank'
        and nullif(btrim(counterpart.organization_name), '') is not null
      then btrim(counterpart.organization_name)
      else nullif(btrim(counterpart.full_name), '')
    end,
    case
      when dm.donor_id = auth.uid() then nullif(btrim(br.patient_name), '')
      else null
    end,
    case
      when dm.donor_id = auth.uid() then 'Blood recipient'
      else 'BloodLink donor'
    end
  ) as display_name,
  case
    when dm.donor_id = auth.uid() then null::public.blood_type
    else counterpart.blood_type
  end as blood_type
from public.donor_matches dm
join public.blood_requests br on br.id = dm.request_id
join public.profiles counterpart
  on counterpart.id = case
    when dm.donor_id = auth.uid() then br.requester_id
    else dm.donor_id
  end
where dm.status in ('accepted', 'completed')
  and dm.donor_id <> br.requester_id
  and (
    dm.donor_id = auth.uid()
    or br.requester_id = auth.uid()
  );

revoke all on public.conversation_counterparts from public;
revoke all on public.conversation_counterparts from anon;
grant select on public.conversation_counterparts to authenticated;

create table if not exists public.conversation_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  donor_match_id uuid not null references public.donor_matches(id) on delete cascade,
  status text not null check (status in ('active', 'archived', 'deleted')),
  updated_at timestamptz not null default now(),
  primary key (user_id, donor_match_id)
);

alter table public.conversation_states enable row level security;

drop policy if exists "conversation states select own" on public.conversation_states;

create policy "conversation states select own"
on public.conversation_states
for select to authenticated
using (user_id = auth.uid());

revoke all on public.conversation_states from public;
revoke all on public.conversation_states from anon;
grant select on public.conversation_states to authenticated;

create or replace function public.set_conversation_state(
  p_donor_match_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if p_status not in ('active', 'archived', 'deleted') then
    raise exception 'Invalid conversation status'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.donor_matches dm
    join public.blood_requests br on br.id = dm.request_id
    where dm.id = p_donor_match_id
      and dm.donor_id <> br.requester_id
      and dm.status in ('accepted', 'completed')
      and (dm.donor_id = v_uid or br.requester_id = v_uid)
  ) then
    raise exception 'You are not a participant in this conversation'
      using errcode = '42501';
  end if;

  insert into public.conversation_states (user_id, donor_match_id, status, updated_at)
  values (v_uid, p_donor_match_id, p_status, now())
  on conflict (user_id, donor_match_id)
  do update set
    status = excluded.status,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_conversation_state(uuid, text) from public;
revoke all on function public.set_conversation_state(uuid, text) from anon;
grant execute on function public.set_conversation_state(uuid, text) to authenticated;

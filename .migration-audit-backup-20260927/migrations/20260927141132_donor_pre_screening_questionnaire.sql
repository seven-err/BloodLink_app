-- Digital Donor Pre-Screening / Donor History Questionnaire.
-- Preliminary donor-provided history only; this does not alter final eligibility.
-- Donors submit immutable answers through RPC. Sensitive detail is available
-- only to the verified blood-bank profile associated with the donation.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- A donation is the concrete collection/handling event, so it owns the
-- blood-bank association. QR verification atomically assigns this field.
alter table public.donations
  add column bloodbank_id uuid references public.profiles(id) on delete set null;

create index donations_bloodbank_created_idx
  on public.donations (bloodbank_id, created_at desc)
  where bloodbank_id is not null;

comment on column public.donations.bloodbank_id is
  'Verified blood-bank profile handling this donation; assigned by QR verification.';

drop policy if exists "donations select involved admin bloodbank" on public.donations;
create policy "donations select involved admin associated bloodbank" on public.donations
for select to authenticated
using (
  donor_id = (select auth.uid())
  or public.is_admin((select auth.uid()))
  or (
    bloodbank_id = (select auth.uid())
    and public.is_bloodbank_verified((select auth.uid()))
  )
  or exists (
    select 1 from public.blood_requests br
    where br.id = donations.request_id
      and br.requester_id = (select auth.uid())
  )
);

create or replace function public.enforce_donation_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status = 'completed'
     and not public.is_elevated_role_context()
  then
    raise exception 'Donation completion requires QR verification' using errcode = '42501';
  end if;

  if public.is_elevated_role_context() or public.is_admin((select auth.uid())) then
    return new;
  end if;

  if new.match_id is distinct from old.match_id
     or new.donor_id is distinct from old.donor_id
     or new.request_id is distinct from old.request_id
     or new.bloodbank_id is distinct from old.bloodbank_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot modify donation identity columns' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Donation status changes must use authorized RPCs' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.verify_donation_qr(p_donation_id uuid, p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean;
  v_is_bloodbank boolean;
  v_donation public.donations;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_is_admin := public.is_admin(v_actor);
  v_is_bloodbank := public.is_bloodbank_verified(v_actor);
  if not (v_is_admin or v_is_bloodbank) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  if p_token is null or char_length(trim(p_token)) = 0 then return json_build_object('valid', false); end if;

  select d.* into v_donation
  from public.donations d
  where d.id = p_donation_id and d.verification_token = p_token
  for update;
  if not found then return json_build_object('valid', false); end if;

  if v_is_bloodbank then
    if v_donation.bloodbank_id is not null and v_donation.bloodbank_id is distinct from v_actor then
      raise exception 'Donation is associated with another blood bank' using errcode = '42501';
    end if;
    if v_donation.bloodbank_id is null then
      update public.donations d set bloodbank_id = v_actor
      where d.id = v_donation.id returning d.* into v_donation;
    end if;
  end if;

  return json_build_object(
    'valid', true, 'donation_id', v_donation.id, 'donation_status', v_donation.status,
    'match_id', v_donation.match_id, 'donor_id', v_donation.donor_id,
    'request_id', v_donation.request_id
  );
end;
$$;

revoke all on function public.verify_donation_qr(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_donation_qr(uuid, text) to authenticated;

create or replace function public.complete_verified_donation(
  p_donation_id uuid,
  p_token text,
  p_units_donated integer default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean;
  v_is_bloodbank boolean;
  v_donation public.donations;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_is_admin := public.is_admin(v_actor);
  v_is_bloodbank := public.is_bloodbank_verified(v_actor);
  if not (v_is_admin or v_is_bloodbank) then raise exception 'Unauthorized' using errcode = '42501'; end if;
  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'A verification token is required' using errcode = '22023';
  end if;
  if p_units_donated is not null and p_units_donated <= 0 then
    raise exception 'Units donated must be positive' using errcode = '22023';
  end if;

  select d.* into v_donation
  from public.donations d
  where d.id = p_donation_id and d.verification_token = p_token
  for update;
  if not found then return json_build_object('success', false, 'reason', 'invalid_token'); end if;

  if v_is_bloodbank then
    if v_donation.bloodbank_id is not null and v_donation.bloodbank_id is distinct from v_actor then
      raise exception 'Donation is associated with another blood bank' using errcode = '42501';
    end if;
    if v_donation.bloodbank_id is null then
      update public.donations d set bloodbank_id = v_actor
      where d.id = v_donation.id returning d.* into v_donation;
    end if;
  end if;

  if v_donation.status = 'completed' then
    return json_build_object(
      'success', true, 'already_completed', true, 'donation_id', v_donation.id,
      'donation_status', v_donation.status, 'match_id', v_donation.match_id
    );
  end if;
  if v_donation.status <> 'scheduled' then
    raise exception 'Donation is % and cannot be completed', v_donation.status using errcode = '22023';
  end if;

  update public.donations d
  set status = 'completed', completed_at = now(),
      units_donated = coalesce(p_units_donated, d.units_donated),
      notes = coalesce(nullif(trim(p_notes), ''), d.notes)
  where d.id = v_donation.id returning d.* into v_donation;

  return json_build_object(
    'success', true, 'donation_id', v_donation.id,
    'donation_status', v_donation.status, 'match_id', v_donation.match_id
  );
end;
$$;

revoke all on function public.complete_verified_donation(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.complete_verified_donation(uuid, text, integer, text) to authenticated;

create or replace function public.set_donation_status(
  p_donation_id uuid,
  p_status public.donation_status
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.donations;
  v_current public.donation_status;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not (public.is_admin(v_actor) or public.is_bloodbank_verified(v_actor)) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_status = 'completed' then
    raise exception 'Donation completion requires QR verification' using errcode = '22023';
  end if;

  select d.* into v_row from public.donations d where d.id = p_donation_id for update;
  if not found then raise exception 'Donation not found' using errcode = 'P0002'; end if;
  if not public.is_admin(v_actor) and v_row.bloodbank_id is distinct from v_actor then
    raise exception 'Donation is not associated with this blood bank' using errcode = '42501';
  end if;

  v_current := v_row.status;
  if v_current <> p_status then
    if not (v_current = 'scheduled' and p_status in ('cancelled', 'no_show')) then
      raise exception 'Invalid status transition from % to %', v_current, p_status using errcode = '22023';
    end if;
    update public.donations d set status = p_status
    where d.id = p_donation_id returning d.* into v_row;
  end if;

  return json_build_object(
    'id', v_row.id, 'match_id', v_row.match_id, 'donor_id', v_row.donor_id,
    'request_id', v_row.request_id, 'bloodbank_id', v_row.bloodbank_id,
    'status', v_row.status, 'scheduled_at', v_row.scheduled_at,
    'completed_at', v_row.completed_at, 'units_donated', v_row.units_donated,
    'notes', v_row.notes, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.set_donation_status(uuid, public.donation_status) from public, anon, authenticated;
grant execute on function public.set_donation_status(uuid, public.donation_status) to authenticated;

create table public.donor_pre_screenings (
  id uuid primary key default gen_random_uuid(),
  -- There is no account-deletion/medical-retention policy in BloodLink. Keep
  -- CASCADE consistent with existing profile-owned donation history instead of
  -- inventing a retention period or silently retaining identifiable answers.
  donor_id uuid not null references public.profiles(id) on delete cascade,
  questionnaire_version text not null check (char_length(trim(questionnaire_version)) > 0),
  responses jsonb not null check (jsonb_typeof(responses) = 'object' and pg_column_size(responses) <= 65536),
  requires_staff_review boolean not null,
  acknowledged_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index donor_pre_screenings_donor_completed_idx
  on public.donor_pre_screenings (donor_id, completed_at desc);
create index donor_pre_screenings_review_queue_idx
  on public.donor_pre_screenings (completed_at desc) where requires_staff_review = true;

create table public.donor_pre_screening_reviews (
  id uuid primary key default gen_random_uuid(),
  pre_screening_id uuid not null references public.donor_pre_screenings(id) on delete cascade,
  donation_id uuid not null references public.donations(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  review_status text not null default 'reviewed' check (review_status = 'reviewed'),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);

create index donor_pre_screening_reviews_screening_created_idx
  on public.donor_pre_screening_reviews (pre_screening_id, donation_id, created_at desc);

comment on table public.donor_pre_screening_reviews is
  'Append-only internal blood-bank review history. Donors and generic admins cannot read notes.';

create or replace function private.validate_donor_pre_screening_responses(p_responses jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_yes_no_keys constant text[] := array[
    'feeling_healthy_today', 'taking_medication', 'recent_vaccination',
    'aspirin_past_3_days', 'donated_past_12_weeks',
    'transfusion_past_12_months', 'surgery_or_dental_past_12_months',
    'tattoo_piercing_blood_contact_acupuncture_past_12_months',
    'sexual_contact_relevant_screening', 'sexual_contact_exchange',
    'sexual_contact_with_worker_abroad', 'casual_sex', 'lived_with_hepatitis',
    'imprisoned_past_12_months', 'lived_outside_usual_residence',
    'lived_outside_philippines', 'injected_nonprescribed_substances',
    'used_clotting_factor_concentrates', 'positive_test_infectious',
    'had_hepatitis', 'had_malaria', 'sti_history', 'cancer_history',
    'heart_lung_problems', 'bleeding_or_blood_disease', 'donating_for_testing',
    'understands_asymptomatic_transmission'
  ];
  v_key text;
begin
  if p_responses is null or jsonb_typeof(p_responses) <> 'object'
     or pg_column_size(p_responses) > 65536
  then return false; end if;

  foreach v_key in array v_yes_no_keys loop
    if not (p_responses ? v_key) or p_responses ->> v_key not in ('yes', 'no') then
      return false;
    end if;
  end loop;

  if not (p_responses ? 'pregnant_or_recently_pregnant')
     or p_responses ->> 'pregnant_or_recently_pregnant' not in ('yes', 'no', 'not_applicable')
  then return false; end if;
  if not (p_responses ? 'relative_cjd')
     or p_responses ->> 'relative_cjd' not in ('yes', 'no', 'dont_know')
  then return false; end if;

  if p_responses ->> 'recent_vaccination' = 'yes'
     and coalesce(char_length(trim(p_responses ->> 'vaccination_details')), 0) = 0
  then return false; end if;
  if p_responses ->> 'lived_outside_usual_residence' = 'yes'
     and coalesce(char_length(trim(p_responses ->> 'other_residence_location')), 0) = 0
  then return false; end if;
  if p_responses ->> 'lived_outside_philippines' = 'yes'
     and coalesce(char_length(trim(p_responses ->> 'countries_lived_in')), 0) = 0
  then return false; end if;

  return true;
end;
$$;

create or replace function private.donor_pre_screening_requires_review(p_responses jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_responses ->> 'feeling_healthy_today' = 'no'
    or p_responses ->> 'taking_medication' = 'yes'
    or p_responses ->> 'recent_vaccination' = 'yes'
    or p_responses ->> 'aspirin_past_3_days' = 'yes'
    or p_responses ->> 'pregnant_or_recently_pregnant' = 'yes'
    or p_responses ->> 'donated_past_12_weeks' = 'yes'
    or p_responses ->> 'transfusion_past_12_months' = 'yes'
    or p_responses ->> 'surgery_or_dental_past_12_months' = 'yes'
    or p_responses ->> 'tattoo_piercing_blood_contact_acupuncture_past_12_months' = 'yes'
    or p_responses ->> 'sexual_contact_relevant_screening' = 'yes'
    or p_responses ->> 'sexual_contact_exchange' = 'yes'
    or p_responses ->> 'sexual_contact_with_worker_abroad' = 'yes'
    or p_responses ->> 'casual_sex' = 'yes'
    or p_responses ->> 'lived_with_hepatitis' = 'yes'
    or p_responses ->> 'imprisoned_past_12_months' = 'yes'
    or p_responses ->> 'relative_cjd' in ('yes', 'dont_know')
    or p_responses ->> 'lived_outside_usual_residence' = 'yes'
    or p_responses ->> 'lived_outside_philippines' = 'yes'
    or p_responses ->> 'injected_nonprescribed_substances' = 'yes'
    or p_responses ->> 'used_clotting_factor_concentrates' = 'yes'
    or p_responses ->> 'positive_test_infectious' = 'yes'
    or p_responses ->> 'had_hepatitis' = 'yes'
    or p_responses ->> 'had_malaria' = 'yes'
    or p_responses ->> 'sti_history' = 'yes'
    or p_responses ->> 'cancer_history' = 'yes'
    or p_responses ->> 'heart_lung_problems' = 'yes'
    or p_responses ->> 'bleeding_or_blood_disease' = 'yes'
    or p_responses ->> 'donating_for_testing' = 'yes'
    or p_responses ->> 'understands_asymptomatic_transmission' = 'no';
$$;

alter table public.donor_pre_screenings enable row level security;
alter table public.donor_pre_screening_reviews enable row level security;

revoke all on table public.donor_pre_screenings from public, anon, authenticated;
grant select on table public.donor_pre_screenings to authenticated;
revoke all on table public.donor_pre_screening_reviews from public, anon, authenticated;
grant select on table public.donor_pre_screening_reviews to authenticated;

create policy "donor pre screenings select own" on public.donor_pre_screenings
for select to authenticated using ((select auth.uid()) = donor_id);

create policy "pre screening reviews select associated verified bloodbank"
on public.donor_pre_screening_reviews
for select to authenticated
using (
  public.is_bloodbank_verified((select auth.uid()))
  and exists (
    select 1 from public.donations d
    where d.id = donor_pre_screening_reviews.donation_id
      and d.bloodbank_id = (select auth.uid())
  )
);

create or replace function public.submit_donor_pre_screening(
  p_questionnaire_version text,
  p_responses jsonb,
  p_acknowledged boolean
)
returns public.donor_pre_screenings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.donor_pre_screenings;
  v_now timestamptz := now();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.role = 'donor') then
    raise exception 'Only donor profiles may submit pre-screening' using errcode = '42501';
  end if;
  if p_acknowledged is distinct from true then
    raise exception 'Acknowledgement is required' using errcode = '22023';
  end if;
  if p_questionnaire_version is null or char_length(trim(p_questionnaire_version)) = 0
     or char_length(trim(p_questionnaire_version)) > 100
  then raise exception 'Questionnaire version is required' using errcode = '22023'; end if;
  if not private.validate_donor_pre_screening_responses(p_responses) then
    raise exception 'Incomplete or invalid donor pre-screening responses' using errcode = '22023';
  end if;

  insert into public.donor_pre_screenings (
    donor_id, questionnaire_version, responses, requires_staff_review,
    acknowledged_at, completed_at
  ) values (
    v_actor, trim(p_questionnaire_version), p_responses,
    private.donor_pre_screening_requires_review(p_responses), v_now, v_now
  ) returning * into v_row;

  update public.profiles p set onboarding_completed = true
  where p.id = v_actor and p.role = 'donor'
    and p.blood_type is not null and p.birthdate is not null and p.weight_kg is not null;

  return v_row;
end;
$$;

-- Metadata-only: admins may call this for any donation; verified blood banks
-- may call it only for their associated donation.
create or replace function public.get_donor_pre_screening_summary(p_donation_id uuid)
returns table (
  id uuid,
  donor_id uuid,
  questionnaire_version text,
  status text,
  requires_staff_review boolean,
  completed_at timestamptz,
  review_status text,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_donation public.donations;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select d.* into v_donation from public.donations d where d.id = p_donation_id;
  if not found then raise exception 'Donation not found' using errcode = 'P0002'; end if;
  if not public.is_admin(v_actor)
     and not (public.is_bloodbank_verified(v_actor) and v_donation.bloodbank_id = v_actor)
  then raise exception 'Unauthorized' using errcode = '42501'; end if;

  return query
  select ps.id, ps.donor_id, ps.questionnaire_version,
         case when latest_review.id is null then 'completed' else 'reviewed' end,
         ps.requires_staff_review, ps.completed_at,
         latest_review.review_status, latest_review.created_at
  from public.donor_pre_screenings ps
  left join lateral (
    select r.id, r.review_status, r.created_at
    from public.donor_pre_screening_reviews r
    where r.pre_screening_id = ps.id and r.donation_id = v_donation.id
    order by r.created_at desc, r.id desc limit 1
  ) latest_review on true
  where ps.donor_id = v_donation.donor_id
    and ps.completed_at <= coalesce(v_donation.completed_at, now())
  order by ps.completed_at desc limit 1;
end;
$$;

-- Sensitive answers and internal notes: associated verified blood bank only.
create or replace function public.get_donor_pre_screening_detail(p_donation_id uuid)
returns table (
  id uuid,
  donor_id uuid,
  questionnaire_version text,
  responses jsonb,
  requires_staff_review boolean,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  review_status text,
  review_notes text,
  reviewed_by uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  review_history jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_donation public.donations;
begin
  if v_actor is null or not public.is_bloodbank_verified(v_actor) then
    raise exception 'Only verified blood-bank staff may view detailed pre-screening records'
      using errcode = '42501';
  end if;
  select d.* into v_donation from public.donations d
  where d.id = p_donation_id and d.bloodbank_id = v_actor;
  if not found then
    raise exception 'Donation not found or not associated with this blood bank'
      using errcode = '42501';
  end if;

  return query
  select ps.id, ps.donor_id, ps.questionnaire_version, ps.responses,
         ps.requires_staff_review, ps.acknowledged_at, ps.completed_at,
         latest_review.review_status, latest_review.notes,
         latest_review.reviewer_id, latest_review.reviewer_name,
         latest_review.created_at, coalesce(history.items, '[]'::jsonb)
  from public.donor_pre_screenings ps
  left join lateral (
    select r.review_status, r.notes, r.reviewer_id,
           p.full_name as reviewer_name, r.created_at
    from public.donor_pre_screening_reviews r
    join public.profiles p on p.id = r.reviewer_id
    where r.pre_screening_id = ps.id and r.donation_id = v_donation.id
    order by r.created_at desc, r.id desc limit 1
  ) latest_review on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id, 'review_status', r.review_status, 'notes', r.notes,
        'reviewer_id', r.reviewer_id, 'reviewer_name', p.full_name,
        'created_at', r.created_at
      ) order by r.created_at desc, r.id desc
    ) as items
    from public.donor_pre_screening_reviews r
    join public.profiles p on p.id = r.reviewer_id
    where r.pre_screening_id = ps.id and r.donation_id = v_donation.id
  ) history on true
  where ps.donor_id = v_donation.donor_id
    and ps.completed_at <= coalesce(v_donation.completed_at, now())
  order by ps.completed_at desc limit 1;
end;
$$;

create or replace function public.review_donor_pre_screening(
  p_donation_id uuid,
  p_pre_screening_id uuid,
  p_review_notes text default null
)
returns public.donor_pre_screening_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.donor_pre_screening_reviews;
begin
  if v_actor is null or not public.is_bloodbank_verified(v_actor) then
    raise exception 'Only verified blood-bank staff may review pre-screening records'
      using errcode = '42501';
  end if;
  if p_review_notes is not null and char_length(trim(p_review_notes)) > 4000 then
    raise exception 'Review notes are too long' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.donations d
    join public.donor_pre_screenings ps on ps.donor_id = d.donor_id
    where d.id = p_donation_id and d.bloodbank_id = v_actor
      and ps.id = p_pre_screening_id
      and ps.completed_at <= coalesce(d.completed_at, now())
  ) then
    raise exception 'Pre-screening record is not associated with this blood bank donation'
      using errcode = '42501';
  end if;

  insert into public.donor_pre_screening_reviews (
    pre_screening_id, donation_id, reviewer_id, review_status, notes
  ) values (
    p_pre_screening_id, p_donation_id, v_actor, 'reviewed', nullif(trim(p_review_notes), '')
  ) returning * into v_row;
  return v_row;
end;
$$;

revoke all on function private.validate_donor_pre_screening_responses(jsonb) from public, anon, authenticated;
revoke all on function private.donor_pre_screening_requires_review(jsonb) from public, anon, authenticated;

revoke all on function public.submit_donor_pre_screening(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.submit_donor_pre_screening(text, jsonb, boolean) to authenticated;
revoke all on function public.get_donor_pre_screening_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_donor_pre_screening_summary(uuid) to authenticated;
revoke all on function public.get_donor_pre_screening_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_donor_pre_screening_detail(uuid) to authenticated;
revoke all on function public.review_donor_pre_screening(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.review_donor_pre_screening(uuid, uuid, text) to authenticated;

comment on table public.donor_pre_screenings is
  'Immutable donor-provided preliminary history. Completion is not final donation eligibility.';
comment on column public.donor_pre_screenings.requires_staff_review is
  'Workflow flag only. It is not a medical eligibility determination.';
comment on function public.get_donor_pre_screening_summary(uuid) is
  'Metadata-only summary for admins or the verified blood bank associated with the donation.';
comment on function public.get_donor_pre_screening_detail(uuid) is
  'Sensitive answers and internal review history for the associated verified blood bank.';

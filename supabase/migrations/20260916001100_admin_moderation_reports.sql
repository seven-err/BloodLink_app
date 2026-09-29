-- Phase 9: admin moderation / reports — RPC-only status transitions + audit trail.
-- Canonical report_status remains: open | reviewing | resolved | dismissed.
-- Account suspension is NOT implemented (profiles have no suspension fields).

create type public.report_moderation_action as enum (
  'review',
  'resolve',
  'dismiss',
  'warn'
);

create table public.report_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action public.report_moderation_action not null,
  previous_status public.report_status not null,
  resulting_status public.report_status not null,
  notes text,
  created_at timestamptz not null default now()
);

create index report_moderation_actions_report_created_idx
  on public.report_moderation_actions(report_id, created_at desc);

create index report_moderation_actions_actor_created_idx
  on public.report_moderation_actions(actor_id, created_at desc);

alter table public.report_moderation_actions enable row level security;

-- Admins may read the audit trail. Writes happen only via SECURITY DEFINER RPCs.
create policy "report_moderation_actions select admin"
on public.report_moderation_actions
for select to authenticated
using (public.is_admin());

-- Force report status mutations through review_report / warn_reported_user RPCs.
drop policy if exists "reports update admin" on public.reports;

-- ----------------------------------------------------------------------------
-- submit_report — authenticated users create their own reports (no self-report).
-- ----------------------------------------------------------------------------
create or replace function public.submit_report(
  p_type public.report_type,
  p_reason text,
  p_details text default null,
  p_reported_user_id uuid default null,
  p_blood_request_id uuid default null,
  p_message_id uuid default null,
  p_donation_id uuid default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_details text;
  v_row public.reports;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Report reason is required'
      using errcode = '22023';
  end if;

  if char_length(v_reason) > 200 then
    raise exception 'Report reason is too long'
      using errcode = '22023';
  end if;

  v_details := nullif(btrim(coalesce(p_details, '')), '');
  if v_details is not null and char_length(v_details) > 2000 then
    raise exception 'Report details are too long'
      using errcode = '22023';
  end if;

  if p_reported_user_id is null
     and p_blood_request_id is null
     and p_message_id is null
     and p_donation_id is null then
    raise exception 'Report must target a user, request, message, or donation'
      using errcode = '22023';
  end if;

  if p_reported_user_id is not null and p_reported_user_id = auth.uid() then
    raise exception 'You cannot report yourself'
      using errcode = '22023';
  end if;

  if p_reported_user_id is not null
     and not exists (select 1 from public.profiles where id = p_reported_user_id) then
    raise exception 'Reported user not found'
      using errcode = 'P0002';
  end if;

  if p_message_id is not null then
    if not exists (
      select 1
      from public.messages m
      where m.id = p_message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    ) then
      raise exception 'Unauthorized'
        using errcode = '42501';
    end if;
  end if;

  if p_blood_request_id is not null then
    if not exists (
      select 1
      from public.blood_requests br
      where br.id = p_blood_request_id
        and (
          br.requester_id = auth.uid()
          or public.is_matched_donor_for_request(br.id)
          or public.is_admin()
          or public.is_bloodbank_verified()
        )
    ) then
      raise exception 'Unauthorized'
        using errcode = '42501';
    end if;
  end if;

  if p_donation_id is not null then
    if not exists (
      select 1
      from public.donations d
      where d.id = p_donation_id
        and (
          d.donor_id = auth.uid()
          or public.is_admin()
          or public.is_bloodbank_verified()
          or exists (
            select 1
            from public.blood_requests br
            where br.id = d.request_id
              and br.requester_id = auth.uid()
          )
        )
    ) then
      raise exception 'Unauthorized'
        using errcode = '42501';
    end if;
  end if;

  insert into public.reports (
    reporter_id,
    reported_user_id,
    blood_request_id,
    message_id,
    donation_id,
    type,
    status,
    reason,
    details
  )
  values (
    auth.uid(),
    p_reported_user_id,
    p_blood_request_id,
    p_message_id,
    p_donation_id,
    p_type,
    'open',
    v_reason,
    v_details
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_report(
  public.report_type, text, text, uuid, uuid, uuid, uuid
) from public;
revoke all on function public.submit_report(
  public.report_type, text, text, uuid, uuid, uuid, uuid
) from anon;
grant execute on function public.submit_report(
  public.report_type, text, text, uuid, uuid, uuid, uuid
) to authenticated;

comment on function public.submit_report(
  public.report_type, text, text, uuid, uuid, uuid, uuid
) is
  'Authenticated users submit a safety report against a user/request/message/donation.';

-- Keep direct INSERT policy for simple client inserts, but prefer submit_report.
-- No change to insert policy.

-- ----------------------------------------------------------------------------
-- review_report — admin-only status transitions with append-only audit rows.
-- ----------------------------------------------------------------------------
create or replace function public.review_report(
  p_report_id uuid,
  p_status public.report_status,
  p_notes text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reports;
  v_prev public.report_status;
  v_notes text;
  v_action public.report_moderation_action;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if p_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid moderation status %', p_status
      using errcode = '22023';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if p_status in ('resolved', 'dismissed') and v_notes is null then
    raise exception 'Resolution notes are required'
      using errcode = '22023';
  end if;

  select *
    into v_row
    from public.reports
   where id = p_report_id
   for update;

  if not found then
    raise exception 'Report not found'
      using errcode = 'P0002';
  end if;

  v_prev := v_row.status;

  if v_prev in ('resolved', 'dismissed') then
    raise exception 'Report is already closed'
      using errcode = '22023';
  end if;

  if p_status = 'reviewing' then
    if v_prev is distinct from 'open' then
      raise exception 'Invalid status transition from % to reviewing', v_prev
        using errcode = '22023';
    end if;
    v_action := 'review';
  elsif p_status = 'resolved' then
    if v_prev not in ('open', 'reviewing') then
      raise exception 'Invalid status transition from % to resolved', v_prev
        using errcode = '22023';
    end if;
    v_action := 'resolve';
  else
    if v_prev not in ('open', 'reviewing') then
      raise exception 'Invalid status transition from % to dismissed', v_prev
        using errcode = '22023';
    end if;
    v_action := 'dismiss';
  end if;

  update public.reports
     set status = p_status,
         reviewed_by = case
           when p_status in ('resolved', 'dismissed') then auth.uid()
           else reviewed_by
         end,
         reviewed_at = case
           when p_status in ('resolved', 'dismissed') then now()
           else reviewed_at
         end,
         resolution_notes = case
           when p_status in ('resolved', 'dismissed') then v_notes
           when v_notes is not null then v_notes
           else resolution_notes
         end
   where id = p_report_id
   returning * into v_row;

  insert into public.report_moderation_actions (
    report_id,
    actor_id,
    action,
    previous_status,
    resulting_status,
    notes
  )
  values (
    p_report_id,
    auth.uid(),
    v_action,
    v_prev,
    v_row.status,
    v_notes
  );

  return v_row;
end;
$$;

revoke all on function public.review_report(
  uuid, public.report_status, text
) from public;
revoke all on function public.review_report(
  uuid, public.report_status, text
) from anon;
grant execute on function public.review_report(
  uuid, public.report_status, text
) to authenticated;

comment on function public.review_report(
  uuid, public.report_status, text
) is
  'Admin-only report status transition (open→reviewing|resolved|dismissed) with audit trail.';

-- ----------------------------------------------------------------------------
-- warn_reported_user — admin-only auditable warning via in-app notification.
-- Does not suspend accounts (no suspension architecture).
-- ----------------------------------------------------------------------------
create or replace function public.warn_reported_user(
  p_report_id uuid,
  p_notes text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reports;
  v_prev public.report_status;
  v_notes text;
  v_target uuid;
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is null then
    raise exception 'Warning notes are required'
      using errcode = '22023';
  end if;

  select *
    into v_row
    from public.reports
   where id = p_report_id
   for update;

  if not found then
    raise exception 'Report not found'
      using errcode = 'P0002';
  end if;

  if v_row.status in ('resolved', 'dismissed') then
    raise exception 'Report is already closed'
      using errcode = '22023';
  end if;

  v_target := v_row.reported_user_id;
  if v_target is null then
    raise exception 'Report has no reported user to warn'
      using errcode = '22023';
  end if;

  v_prev := v_row.status;

  -- Move open → reviewing so the queue reflects active admin attention.
  if v_row.status = 'open' then
    update public.reports
       set status = 'reviewing',
           resolution_notes = coalesce(resolution_notes, v_notes)
     where id = p_report_id
     returning * into v_row;
  else
    update public.reports
       set resolution_notes = coalesce(v_notes, resolution_notes)
     where id = p_report_id
     returning * into v_row;
  end if;

  v_body := format(
    'A BloodLink administrator issued a warning regarding your recent activity. Reason context: %s',
    left(v_notes, 280)
  );

  perform public.create_app_notification(
    v_target,
    'system'::public.notification_type,
    'Community guidelines warning',
    v_body,
    jsonb_build_object(
      'category', 'moderation_warning',
      'related_report_id', p_report_id
    )
  );

  insert into public.report_moderation_actions (
    report_id,
    actor_id,
    action,
    previous_status,
    resulting_status,
    notes
  )
  values (
    p_report_id,
    auth.uid(),
    'warn',
    v_prev,
    v_row.status,
    v_notes
  );

  return v_row;
end;
$$;

revoke all on function public.warn_reported_user(uuid, text) from public;
revoke all on function public.warn_reported_user(uuid, text) from anon;
grant execute on function public.warn_reported_user(uuid, text) to authenticated;

comment on function public.warn_reported_user(uuid, text) is
  'Admin-only warning: in-app system notification + moderation audit row. No account suspension.';

-- Realtime for admin moderation queue (RLS still filters rows).
do $$
begin
  alter publication supabase_realtime add table public.reports;
exception
  when duplicate_object then
    null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.report_moderation_actions;
exception
  when duplicate_object then
    null;
end;
$$;

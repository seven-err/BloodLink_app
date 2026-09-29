-- Admin emergency shortage broadcast.
-- Creates in-app notifications for eligible donors and names the sending hospital.
-- SMS for opted-in donors is sent by the send-alert-sms webhook on INSERT
-- unless the caller suppresses it (the send-emergency-alert Edge Function sends SMS itself).

create or replace function public.broadcast_emergency_alert(
  p_title text,
  p_body text,
  p_hospital_name text,
  p_target_blood_types text[] default array[]::text[],
  p_suppress_sms_webhook boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_hospital text;
  v_donor record;
  v_id uuid;
  v_notified integer := 0;
  v_skipped integer := 0;
  v_ids uuid[] := array[]::uuid[];
  v_types text[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  v_title := left(trim(coalesce(p_title, '')), 120);
  v_body := left(trim(coalesce(p_body, '')), 500);
  v_hospital := left(trim(coalesce(p_hospital_name, '')), 160);

  if v_title = '' or v_body = '' or v_hospital = '' then
    raise exception 'Title, body, and hospital name are required'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct e.enumlabel), array[]::text[])
  into v_types
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'blood_type'
    and e.enumlabel = any (coalesce(p_target_blood_types, array[]::text[]));

  if coalesce(array_length(v_types, 1), 0) = 0 then
    raise exception 'At least one valid target blood type is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.data->>'category' = 'emergency_shortage'
      and n.created_at > now() - interval '2 minutes'
  ) then
    return json_build_object(
      'status', 'already_sent',
      'notified', 0,
      'skipped_preference', 0,
      'recipient_ids', '[]'::json,
      'hospital_name', v_hospital,
      'message', 'An emergency alert was sent in the last 2 minutes.'
    );
  end if;

  for v_donor in
    select p.id
    from public.profiles p
    where p.role = 'donor'
      and p.blood_type is not null
      and exists (
        select 1
        from unnest(v_types) needed(label)
        where public.is_blood_type_compatible(
          p.blood_type,
          needed.label::public.blood_type
        )
      )
  loop
    v_id := public.create_app_notification(
      v_donor.id,
      'blood_request'::public.notification_type,
      v_title,
      v_body,
      jsonb_build_object(
        'urgency', case
          when coalesce(p_suppress_sms_webhook, false) then 'shortage'
          else 'critical'
        end,
        'priority', 'critical',
        'category', 'emergency_shortage',
        'hospital_name', v_hospital,
        'blood_types', to_jsonb(v_types),
        'suppress_sms_webhook', coalesce(p_suppress_sms_webhook, false)
      )
    );

    if v_id is null then
      v_skipped := v_skipped + 1;
    else
      v_notified := v_notified + 1;
      v_ids := v_ids || v_donor.id;
    end if;
  end loop;

  return json_build_object(
    'status', 'sent',
    'notified', v_notified,
    'skipped_preference', v_skipped,
    'recipient_ids', to_jsonb(v_ids),
    'hospital_name', v_hospital
  );
end;
$$;

revoke all on function public.broadcast_emergency_alert(text, text, text, text[], boolean) from public;
revoke all on function public.broadcast_emergency_alert(text, text, text, text[], boolean) from anon;
grant execute on function public.broadcast_emergency_alert(text, text, text, text[], boolean) to authenticated;
grant execute on function public.broadcast_emergency_alert(text, text, text, text[], boolean) to service_role;

comment on function public.broadcast_emergency_alert(text, text, text, text[], boolean) is
  'Admin-only. Sends an in-app emergency shortage alert to compatible donors. SMS follows unless suppressed.';

-- Replace placeholder blood-bank labels (UAT and similar) with the real hospital.
update public.bloodbank_verifications
set
  hospital_name = 'Cebu Provincial Hospital - Bogo City',
  branch_location = 'Bogo City',
  updated_at = now()
where status = 'approved'
  and (
    hospital_name ilike '%uat%'
    or hospital_name ilike '%fixture%'
    or branch_location ilike '%uat%'
  );

update public.profiles
set
  organization_name = 'Cebu Provincial Hospital - Bogo City',
  full_name = case
    when full_name ilike '%uat%' then 'Cebu Provincial Hospital - Bogo City'
    else full_name
  end,
  address = 'Cebu North Road, Taytayan, Bogo City, Cebu',
  latitude = 11.0466894,
  longitude = 123.9939845
where role = 'bloodbank'
  and (
    organization_name ilike '%uat%'
    or full_name ilike '%uat%'
    or address ilike '%uat%'
  );

-- Normalize placeholder request hospitals to the same real facility.
update public.blood_requests
set
  hospital_name = 'Cebu Provincial Hospital - Bogo City',
  address = case
    when address is null
      or trim(address) = ''
      or address ~* 'asdasd|uat|fixture'
      then 'Taytayan, Bogo City, Cebu'
    else address
  end
where hospital_name ~* 'uat|fixture|dublin|asd|asdasd|^hospital$|^cph|bogo hospital|bogo city hospital|bogo pandan';

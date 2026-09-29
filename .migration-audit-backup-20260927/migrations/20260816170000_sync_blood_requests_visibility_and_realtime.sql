-- Ensure all open blood requests are selectable by authenticated users so that
-- Supabase Realtime can broadcast events to all accounts and donors can browse open requests.
-- Also automatically send in-app notifications to compatible donors when a new open request is created.

-- 1. Compatibility check helper for blood types in SQL
create or replace function public.is_blood_type_compatible(
  donor_type public.blood_type,
  recipient_type public.blood_type
)
returns boolean
language sql
immutable
as $$
  select case
    -- Universal donor O- can donate to all
    when donor_type = 'O-' then true
    -- O+ can donate to all positive types
    when donor_type = 'O+' and recipient_type in ('O+', 'A+', 'B+', 'AB+') then true
    -- A- can donate to A-, A+, AB-, AB+
    when donor_type = 'A-' and recipient_type in ('A-', 'A+', 'AB-', 'AB+') then true
    -- A+ can donate to A+, AB+
    when donor_type = 'A+' and recipient_type in ('A+', 'AB+') then true
    -- B- can donate to B-, B+, AB-, AB+
    when donor_type = 'B-' and recipient_type in ('B-', 'B+', 'AB-', 'AB+') then true
    -- B+ can donate to B+, AB+
    when donor_type = 'B+' and recipient_type in ('B+', 'AB+') then true
    -- AB- can donate to AB-, AB+
    when donor_type = 'AB-' and recipient_type in ('AB-', 'AB+') then true
    -- AB+ can only donate to AB+
    when donor_type = 'AB+' and recipient_type = 'AB+' then true
    else false
  end;
$$;

grant execute on function public.is_blood_type_compatible(public.blood_type, public.blood_type) to authenticated;

-- 2. Update blood_requests SELECT policy to include status = 'open'
drop policy if exists "blood requests select authorized" on public.blood_requests;
drop policy if exists "blood requests select visible" on public.blood_requests;

create policy "blood requests select authorized" on public.blood_requests
for select to authenticated
using (
  status = 'open'
  or requester_id = auth.uid()
  or public.is_admin()
  or public.is_bloodbank()
  or public.is_elevated_role_context()
  or public.is_matched_donor_for_request(id)
);

-- Ensure permissions
grant select on public.blood_requests to authenticated;
grant select on public.open_blood_requests_feed to authenticated;

-- 3. Trigger to notify compatible donors when a new open blood request is created
create or replace function public.notify_donors_of_new_blood_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donor record;
  v_title text;
  v_body text;
begin
  if new.status = 'open' then
    v_title := case
      when new.urgency = 'critical' then '🚨 Urgent: Blood Needed Immediately'
      when new.urgency = 'high' then 'Urgent Blood Request'
      else 'New Blood Request'
    end;

    v_body := format(
      'A new %s blood request was posted for %s (%s unit%s needed).',
      new.blood_type::text,
      coalesce(new.hospital_name, 'a nearby hospital'),
      new.units_needed,
      case when new.units_needed = 1 then '' else 's' end
    );

    for v_donor in
      select p.id
      from public.profiles p
      where p.role = 'donor'
        and p.id <> new.requester_id
        and (
          p.blood_type is null
          or public.is_blood_type_compatible(p.blood_type, new.blood_type)
        )
    loop
      perform public.create_app_notification(
        v_donor.id,
        'blood_request',
        v_title,
        v_body,
        jsonb_build_object(
          'related_request_id', new.id,
          'blood_type', new.blood_type::text,
          'urgency', new.urgency::text
        )
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists blood_requests_notify_donors_on_insert on public.blood_requests;

create trigger blood_requests_notify_donors_on_insert
after insert on public.blood_requests
for each row execute function public.notify_donors_of_new_blood_request();

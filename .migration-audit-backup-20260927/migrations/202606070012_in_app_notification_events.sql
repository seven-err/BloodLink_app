-- In-app notification records for donor/recipient workflow events.
-- Inserts run via security definer helpers; clients may only read/update their own rows.

create or replace function public.create_app_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_app_notification(uuid, public.notification_type, text, text, jsonb) from public;

create or replace function public.notify_recipient_of_donor_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid;
  v_blood_type text;
begin
  select br.requester_id, br.blood_type::text
  into v_requester_id, v_blood_type
  from public.blood_requests br
  where br.id = new.request_id;

  if v_requester_id is not null then
    perform public.create_app_notification(
      v_requester_id,
      'donor_match',
      'New donor response',
      format(
        'A verified donor responded to your %s blood request. Review the response in your request details.',
        v_blood_type
      ),
      jsonb_build_object(
        'related_request_id', new.request_id,
        'related_match_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists donor_matches_notify_recipient_on_insert on public.donor_matches;

create trigger donor_matches_notify_recipient_on_insert
after insert on public.donor_matches
for each row execute function public.notify_recipient_of_donor_response();

create or replace function public.notify_donor_of_match_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blood_type text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'accepted' then
    select br.blood_type::text
    into v_blood_type
    from public.blood_requests br
    where br.id = new.request_id;

    perform public.create_app_notification(
      new.donor_id,
      'donor_match',
      'Match accepted',
      format(
        'Your response to a %s blood request was accepted. Open the request to view coordination details.',
        coalesce(v_blood_type, 'blood')
      ),
      jsonb_build_object(
        'related_request_id', new.request_id,
        'related_match_id', new.id
      )
    );
  elsif new.status = 'declined' then
    perform public.create_app_notification(
      new.donor_id,
      'donor_match',
      'Response declined',
      'A recipient declined your response. You can browse other open requests.',
      jsonb_build_object(
        'related_request_id', new.request_id,
        'related_match_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists donor_matches_notify_donor_on_status_change on public.donor_matches;

create trigger donor_matches_notify_donor_on_status_change
after update of status on public.donor_matches
for each row execute function public.notify_donor_of_match_status_change();

create or replace function public.notify_parties_of_donation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid;
  v_blood_type text;
begin
  select br.requester_id, br.blood_type::text
  into v_requester_id, v_blood_type
  from public.blood_requests br
  where br.id = new.request_id;

  perform public.create_app_notification(
    new.donor_id,
    'donation',
    'Donation record ready',
    'Your donation verification record is ready. Open My Donations to view your QR code.',
    jsonb_build_object(
      'related_request_id', new.request_id,
      'related_match_id', new.match_id,
      'related_donation_id', new.id
    )
  );

  if v_requester_id is not null then
    perform public.create_app_notification(
      v_requester_id,
      'donation',
      'Donation record created',
      format(
        'A donation record was created for your %s blood request.',
        coalesce(v_blood_type, 'blood')
      ),
      jsonb_build_object(
        'related_request_id', new.request_id,
        'related_match_id', new.match_id,
        'related_donation_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists donations_notify_on_insert on public.donations;

create trigger donations_notify_on_insert
after insert on public.donations
for each row execute function public.notify_parties_of_donation_created();

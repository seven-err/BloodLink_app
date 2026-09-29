-- Restrict message updates so recipients cannot tamper with sender-owned content.
-- RLS grants row access; a trigger enforces which columns each role may change.

create or replace function public.enforce_message_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_elevated_role_context() then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or new.blood_request_id is distinct from old.blood_request_id
    or new.donor_match_id is distinct from old.donor_match_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Unauthorized message field change'
      using errcode = '42501';
  end if;

  if auth.uid() = old.recipient_id then
    return new;
  end if;

  if auth.uid() = old.sender_id then
    if new.read_at is distinct from old.read_at then
      raise exception 'Senders cannot change message read state'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status
      and new.status <> 'archived'::public.message_status
    then
      raise exception 'Senders may only archive messages'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'Unauthorized message update'
    using errcode = '42501';
end;
$$;

drop trigger if exists messages_enforce_update_guard on public.messages;

create trigger messages_enforce_update_guard
before update on public.messages
for each row execute function public.enforce_message_update_guard();

drop policy if exists "messages update recipient sender admin" on public.messages;

create policy "messages update recipient" on public.messages
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "messages update sender" on public.messages
for update to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create policy "messages update admin" on public.messages
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

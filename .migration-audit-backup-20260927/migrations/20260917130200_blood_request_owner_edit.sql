-- Owners may correct an open request without posting a new one.
-- Status, ownership, and created_at stay staff-controlled so an edit cannot
-- reopen a closed request or reset the create cooldown.

create or replace function public.protect_blood_request_created_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_elevated_role_context() then
    return new;
  end if;

  if not public.is_admin() then
    new.created_at := old.created_at;
  end if;

  if public.is_admin() or public.is_bloodbank_verified() then
    return new;
  end if;

  if new.requester_id is distinct from old.requester_id then
    raise exception 'Request ownership cannot be changed'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Only staff can change request status'
      using errcode = '42501';
  end if;

  if old.status not in ('draft', 'open', 'matched') then
    raise exception 'This request can no longer be edited'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.protect_blood_request_created_at() is
  'Keeps created_at fixed for non-admins. Owners may edit content only while a request is draft, open, or matched.';

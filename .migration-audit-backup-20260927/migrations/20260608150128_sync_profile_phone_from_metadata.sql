-- Email signups store phone in raw_user_meta_data, not auth.users.phone.
-- Copy metadata phone into profiles when the auth phone column is empty.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, new.phone, 'BloodLink User'), '@', 1)),
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone', '')),
    public.sanitize_user_role(new.raw_user_meta_data->>'role')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Backfill phone for accounts created before this trigger fix.
update public.profiles p
set phone = nullif(u.raw_user_meta_data->>'phone', '')
from auth.users u
where p.id = u.id
  and p.phone is null
  and nullif(u.raw_user_meta_data->>'phone', '') is not null;

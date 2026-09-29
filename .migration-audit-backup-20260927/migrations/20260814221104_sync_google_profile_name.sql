-- Prefer Google OAuth `name` / `full_name` metadata when creating profiles.

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
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, new.phone, 'BloodLink User'), '@', 1)
    ),
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone', '')),
    public.sanitize_user_role(new.raw_user_meta_data->>'role')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- New accounts must choose donor or recipient in setup. A Google name alone
-- must not skip that step. Existing profiles with a blood type already finished setup.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

update public.profiles
set onboarding_completed = true
where blood_type is not null
  and onboarding_completed = false;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone,
    role,
    visible_on_map,
    onboarding_completed
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, new.phone, 'BloodLink User'), '@', 1)
    ),
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone', '')),
    public.sanitize_user_role(new.raw_user_meta_data->>'role'),
    false,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

grant execute on function public.handle_new_user_profile() to supabase_auth_admin;
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

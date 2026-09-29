-- Signup failed with "Database error saving new user" because visible_on_map
-- defaulted to true. New accounts are recipients, and the map guard aborted
-- the auth.users insert with "Only donors can appear on the donor map."

alter table public.profiles
  alter column visible_on_map set default false;

create or replace function public.enforce_donor_map_visibility_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Account creation must not fail. Ineligible rows stay off the map.
  if tg_op = 'INSERT' then
    if new.visible_on_map = true and (
      new.role is distinct from 'donor'
      or new.latitude is null
      or new.longitude is null
      or not public.is_donor_verification_active(new.id)
    ) then
      new.visible_on_map := false;
    end if;

    return new;
  end if;

  if new.visible_on_map is distinct from old.visible_on_map and new.visible_on_map = true then
    if new.role <> 'donor' then
      raise exception 'Only donors can appear on the donor map.';
    end if;

    if new.latitude is null or new.longitude is null then
      raise exception 'Add a location to your profile before appearing on the donor map.';
    end if;

    if not public.is_donor_verification_active(new.id) then
      raise exception 'Verified donors can appear on the donor map after approval.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, visible_on_map)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, new.phone, 'BloodLink User'), '@', 1)
    ),
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone', '')),
    public.sanitize_user_role(new.raw_user_meta_data->>'role'),
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Auth inserts run as supabase_auth_admin. Phase 10 revoked public execute,
-- which can block the signup trigger even though clients must not call it.
grant execute on function public.handle_new_user_profile() to supabase_auth_admin;
grant execute on function public.enforce_donor_map_visibility_guard() to supabase_auth_admin;
grant execute on function public.enforce_donor_availability_guard() to supabase_auth_admin;
grant execute on function public.enforce_profile_role_guard() to supabase_auth_admin;
grant execute on function public.ensure_notification_preferences() to supabase_auth_admin;
grant execute on function public.is_donor_verification_active(uuid) to supabase_auth_admin;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
revoke all on function public.enforce_donor_map_visibility_guard() from public, anon, authenticated;
revoke all on function public.enforce_donor_availability_guard() from public, anon, authenticated;
revoke all on function public.enforce_profile_role_guard() from public, anon, authenticated;
revoke all on function public.ensure_notification_preferences() from public, anon, authenticated;

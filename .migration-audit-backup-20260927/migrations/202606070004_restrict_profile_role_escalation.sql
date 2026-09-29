-- Block privilege escalation via profiles.role (signup metadata, self-update, upsert).

create or replace function public.sanitize_user_role(raw_role text)
returns public.user_role
language sql
immutable
as $$
  select case
    when raw_role in ('donor', 'recipient') then raw_role::public.user_role
    else 'recipient'::public.user_role
  end;
$$;

create or replace function public.is_elevated_role_context()
returns boolean
language sql
stable
as $$
  select
    current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

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
    new.phone,
    public.sanitize_user_role(new.raw_user_meta_data->>'role')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_elevated_role_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role not in ('donor', 'recipient') then
      raise exception 'Only donor or recipient roles can be self-assigned'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if new.role is distinct from old.role then
    if public.is_admin() then
      return new;
    end if;

    if auth.uid() = old.id and new.role in ('donor', 'recipient') then
      return new;
    end if;

    raise exception 'Unauthorized profile role change'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_guard on public.profiles;

create trigger profiles_enforce_role_guard
before insert or update of role on public.profiles
for each row execute function public.enforce_profile_role_guard();

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own admin" on public.profiles;

create policy "profiles insert own" on public.profiles
for insert to authenticated
with check (
  id = auth.uid()
  and role in ('donor', 'recipient')
);

create policy "profiles update own admin" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    id = auth.uid()
    and role in ('donor', 'recipient')
  )
);

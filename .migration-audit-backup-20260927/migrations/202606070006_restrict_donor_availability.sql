-- Block unverified donors from marking themselves available.
-- New profiles rely on is_available default false; verified donors may opt in later.

create or replace function public.is_donor_verification_active(donor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donor_verifications dv
    where dv.donor_id = is_donor_verification_active.donor_id
      and dv.status = 'approved'
      and (dv.expires_at is null or dv.expires_at > now())
  );
$$;

create or replace function public.enforce_donor_availability_guard()
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

  if new.role = 'donor' and new.is_available is true then
    if not public.is_donor_verification_active(new.id) then
      raise exception 'Donor must be verified before becoming available'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_donor_availability on public.profiles;

create trigger profiles_enforce_donor_availability
before insert or update of is_available on public.profiles
for each row execute function public.enforce_donor_availability_guard();

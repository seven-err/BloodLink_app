-- Allow donors with a completed profile to opt into availability without formal document verification.

create or replace function public.is_donor_profile_ready(donor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = donor_id
      and p.role = 'donor'
      and coalesce(nullif(trim(p.full_name), ''), '') <> ''
      and p.blood_type is not null
      and p.birthdate is not null
      and p.weight_kg is not null
      and p.weight_kg >= 50
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
    if not public.is_donor_verification_active(new.id)
       and not public.is_donor_profile_ready(new.id) then
      raise exception 'Complete your donor profile before becoming available'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

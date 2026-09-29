-- Immediately auto-verify donors upon registration and bypass pending/rejected statuses for now.

create or replace function public.is_donor_verification_active(donor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = is_donor_verification_active.donor_id
      and p.role = 'donor'
  );
$$;

create or replace function public.auto_verify_donor_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'donor' then
    insert into public.donor_verifications (
      donor_id,
      status,
      document_path,
      notes,
      reviewed_by,
      reviewed_at
    )
    values (
      new.id,
      'approved',
      'auto-verified',
      'Automatically verified upon registration (bypass mode)',
      new.id,
      now()
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_auto_verify_donor on public.profiles;

create trigger trigger_auto_verify_donor
after insert or update of role on public.profiles
for each row execute function public.auto_verify_donor_on_profile();

-- Backfill any existing donor profiles
insert into public.donor_verifications (
  donor_id,
  status,
  document_path,
  notes,
  reviewed_by,
  reviewed_at
)
select
  p.id,
  'approved',
  'auto-verified',
  'Automatically verified upon registration (bypass mode)',
  p.id,
  now()
from public.profiles p
where p.role = 'donor'
  and not exists (
    select 1 from public.donor_verifications dv
    where dv.donor_id = p.id and dv.status = 'approved'
  )
on conflict do nothing;

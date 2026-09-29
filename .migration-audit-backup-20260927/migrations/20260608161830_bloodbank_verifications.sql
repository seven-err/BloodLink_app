-- Blood bank personnel onboarding and verification

create type public.bloodbank_verification_status as enum ('pending', 'approved', 'rejected');

create table public.bloodbank_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.bloodbank_verification_status not null default 'pending',
  position text not null,
  employee_id text not null,
  hospital_name text not null,
  branch_location text not null,
  work_email text not null,
  work_phone text not null,
  document_paths text[] not null default '{}',
  notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bloodbank_verifications_documents_required check (
    coalesce(array_length(document_paths, 1), 0) >= 1
  ),
  constraint bloodbank_verifications_reviewer_when_reviewed check (
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    or status = 'pending'
  )
);

create unique index bloodbank_verifications_profile_id_idx
  on public.bloodbank_verifications (profile_id);

create trigger bloodbank_verifications_set_updated_at
before update on public.bloodbank_verifications
for each row execute function public.set_updated_at();

alter table public.bloodbank_verifications enable row level security;

create policy "bloodbank_verifications select own or admin"
on public.bloodbank_verifications
for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy "bloodbank_verifications insert own pending"
on public.bloodbank_verifications
for insert to authenticated
with check (
  profile_id = auth.uid()
  and status = 'pending'
);

create policy "bloodbank_verifications update own resubmit"
on public.bloodbank_verifications
for update to authenticated
using (
  public.is_admin()
  or (profile_id = auth.uid() and status = 'rejected')
)
with check (
  public.is_admin()
  or (profile_id = auth.uid() and status = 'pending')
);

-- Staff affiliation documents bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-documents',
  'staff-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "staff documents insert own"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "staff documents select own or admin"
on storage.objects
for select to authenticated
using (
  bucket_id = 'staff-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "staff documents delete own pending"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'staff-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to self-assign bloodbank role during onboarding
create or replace function public.sanitize_user_role(raw_role text)
returns public.user_role
language sql
immutable
as $$
  select case
    when raw_role in ('donor', 'recipient', 'bloodbank') then raw_role::public.user_role
    else 'recipient'::public.user_role
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
    if new.role not in ('donor', 'recipient', 'bloodbank') then
      raise exception 'Only donor, recipient, or bloodbank roles can be self-assigned'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if new.role is distinct from old.role then
    if public.is_admin() then
      return new;
    end if;

    if auth.uid() = old.id and new.role in ('donor', 'recipient', 'bloodbank') then
      return new;
    end if;

    raise exception 'Unauthorized profile role change'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own admin" on public.profiles;

create policy "profiles insert own" on public.profiles
for insert to authenticated
with check (
  id = auth.uid()
  and role in ('donor', 'recipient', 'bloodbank')
);

create policy "profiles update own admin" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    id = auth.uid()
    and role in ('donor', 'recipient', 'bloodbank')
  )
);

-- Blood bank users must have approved verification for elevated access
create or replace function public.is_bloodbank_verified(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bloodbank_verifications bv
    join public.profiles p on p.id = bv.profile_id
    where bv.profile_id = user_id
      and p.role = 'bloodbank'
      and bv.status = 'approved'
  );
$$;

grant execute on function public.is_bloodbank_verified(uuid) to authenticated;

-- BloodLink Task 1.2 initial Supabase backend

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('donor', 'recipient', 'bloodbank', 'admin');
create type public.blood_type as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
create type public.donor_verification_status as enum ('pending', 'approved', 'rejected', 'expired');
create type public.blood_request_status as enum ('draft', 'open', 'matched', 'fulfilled', 'cancelled', 'expired');
create type public.donor_match_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'completed');
create type public.donation_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type public.notification_type as enum ('blood_request', 'donor_match', 'donation', 'verification', 'system');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'recipient',
  full_name text not null,
  phone text unique,
  blood_type public.blood_type,
  organization_name text,
  avatar_path text,
  address text,
  latitude double precision,
  longitude double precision,
  location geography(point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
      then st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
      else null
    end
  ) stored,
  is_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_donor_blood_type_required check (role <> 'donor' or blood_type is not null),
  constraint profiles_latitude_valid check (latitude is null or latitude between -90 and 90),
  constraint profiles_longitude_valid check (longitude is null or longitude between -180 and 180)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.donor_verifications (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete cascade,
  status public.donor_verification_status not null default 'pending',
  document_path text not null,
  notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donor_verifications_reviewer_when_reviewed check (
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    or status in ('pending', 'expired')
  )
);

create trigger donor_verifications_set_updated_at
before update on public.donor_verifications
for each row execute function public.set_updated_at();

create table public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  blood_type public.blood_type not null,
  units_needed integer not null check (units_needed > 0),
  status public.blood_request_status not null default 'draft',
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent', 'critical')),
  patient_name text,
  hospital_name text not null,
  contact_phone text,
  attachment_path text,
  notes text,
  needed_at timestamptz,
  address text,
  latitude double precision,
  longitude double precision,
  location geography(point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
      then st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
      else null
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blood_requests_latitude_valid check (latitude is null or latitude between -90 and 90),
  constraint blood_requests_longitude_valid check (longitude is null or longitude between -180 and 180)
);

create trigger blood_requests_set_updated_at
before update on public.blood_requests
for each row execute function public.set_updated_at();

create table public.donor_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  status public.donor_match_status not null default 'pending',
  distance_meters double precision,
  travel_time_seconds integer,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, donor_id)
);

create trigger donor_matches_set_updated_at
before update on public.donor_matches
for each row execute function public.set_updated_at();

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.donor_matches(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  status public.donation_status not null default 'scheduled',
  scheduled_at timestamptz,
  completed_at timestamptz,
  units_donated integer check (units_donated is null or units_donated > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_blood_type_idx on public.profiles(blood_type);
create index profiles_location_idx on public.profiles using gist(location);
create index donor_verifications_donor_idx on public.donor_verifications(donor_id);
create index donor_verifications_status_idx on public.donor_verifications(status);
create index blood_requests_requester_idx on public.blood_requests(requester_id);
create index blood_requests_status_idx on public.blood_requests(status);
create index blood_requests_blood_type_idx on public.blood_requests(blood_type);
create index blood_requests_location_idx on public.blood_requests using gist(location);
create index donor_matches_request_idx on public.donor_matches(request_id);
create index donor_matches_donor_idx on public.donor_matches(donor_id);
create index donations_donor_idx on public.donations(donor_id);
create index donations_request_idx on public.donations(request_id);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
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
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'recipient')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

create or replace function public.nearby_eligible_donors(
  request_id uuid,
  radius_km double precision default 25,
  max_results integer default 25
)
returns table (
  donor_id uuid,
  full_name text,
  blood_type public.blood_type,
  distance_meters double precision
)
language sql
stable
security invoker
as $$
  select
    p.id as donor_id,
    p.full_name,
    p.blood_type,
    st_distance(p.location, br.location) as distance_meters
  from public.blood_requests br
  join public.profiles p on p.role = 'donor'
  where br.id = nearby_eligible_donors.request_id
    and br.status = 'open'
    and br.location is not null
    and p.location is not null
    and p.is_available = true
    and p.blood_type = br.blood_type
    and exists (
      select 1 from public.donor_verifications dv
      where dv.donor_id = p.id
        and dv.status = 'approved'
        and (dv.expires_at is null or dv.expires_at > now())
    )
    and st_dwithin(p.location, br.location, radius_km * 1000)
  order by p.location <-> br.location
  limit greatest(1, max_results);
$$;

alter table public.profiles enable row level security;
alter table public.donor_verifications enable row level security;
alter table public.blood_requests enable row level security;
alter table public.donor_matches enable row level security;
alter table public.donations enable row level security;
alter table public.notifications enable row level security;

create policy "profiles select own authenticated admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles update own admin" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "profiles insert own" on public.profiles
for insert to authenticated
with check (id = auth.uid());

create policy "donor verifications select own admin" on public.donor_verifications
for select to authenticated
using (donor_id = auth.uid() or public.is_admin());

create policy "donor verifications insert own" on public.donor_verifications
for insert to authenticated
with check (donor_id = auth.uid());

create policy "donor verifications update admin" on public.donor_verifications
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "blood requests select visible" on public.blood_requests
for select to authenticated
using (requester_id = auth.uid() or status = 'open' or public.is_admin());

create policy "blood requests insert own" on public.blood_requests
for insert to authenticated
with check (requester_id = auth.uid());

create policy "blood requests update owner admin" on public.blood_requests
for update to authenticated
using (requester_id = auth.uid() or public.is_admin())
with check (requester_id = auth.uid() or public.is_admin());

create policy "donor matches select involved admin" on public.donor_matches
for select to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

create policy "donor matches insert owner admin" on public.donor_matches
for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

create policy "donor matches update involved admin" on public.donor_matches
for update to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
)
with check (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.requester_id = auth.uid()
  )
);

create policy "donations select involved admin" on public.donations
for select to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donations.request_id
      and br.requester_id = auth.uid()
  )
);

create policy "donations insert matched parties admin" on public.donations
for insert to authenticated
with check (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donations.request_id
      and br.requester_id = auth.uid()
  )
);

create policy "donations update involved admin" on public.donations
for update to authenticated
using (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donations.request_id
      and br.requester_id = auth.uid()
  )
)
with check (
  donor_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.blood_requests br
    where br.id = donations.request_id
      and br.requester_id = auth.uid()
  )
);

create policy "notifications select own admin" on public.notifications
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notifications update own admin" on public.notifications
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "notifications insert admin" on public.notifications
for insert to authenticated
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('medical-documents', 'medical-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('blood-request-attachments', 'blood-request-attachments', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "profile images authenticated read" on storage.objects
for select to authenticated
using (bucket_id = 'profile-images');

create policy "profile images owner write" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile images owner update" on storage.objects
for update to authenticated
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "medical documents owner admin read" on storage.objects
for select to authenticated
using (bucket_id = 'medical-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "medical documents owner write" on storage.objects
for insert to authenticated
with check (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "request attachments owner admin read" on storage.objects
for select to authenticated
using (bucket_id = 'blood-request-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "request attachments owner write" on storage.objects
for insert to authenticated
with check (bucket_id = 'blood-request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.blood_requests;
alter publication supabase_realtime add table public.donor_matches;
alter publication supabase_realtime add table public.notifications;

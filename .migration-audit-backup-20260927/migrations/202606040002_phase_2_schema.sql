-- BloodLink Task 2.1-2.3 phase 2 schema

create type public.message_status as enum ('sent', 'read', 'archived');
create type public.availability_status as enum ('available', 'unavailable', 'scheduled');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.report_type as enum ('user', 'blood_request', 'message', 'donation', 'system');
create type public.analytics_event_type as enum ('screen_view', 'auth', 'blood_request', 'donation', 'matching', 'notification', 'system');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  blood_request_id uuid references public.blood_requests(id) on delete set null,
  donor_match_id uuid references public.donor_matches(id) on delete set null,
  body text not null check (char_length(trim(body)) > 0),
  status public.message_status not null default 'sent',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_no_self_message check (sender_id <> recipient_id),
  constraint messages_read_status_consistent check (
    (status = 'read' and read_at is not null)
    or status in ('sent', 'archived')
  )
);

create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.availability_status not null default 'available',
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_time_range check (ends_at is null or ends_at > starts_at)
);

create trigger availability_set_updated_at
before update on public.availability
for each row execute function public.set_updated_at();

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(trim(question)) > 0),
  answer text not null check (char_length(trim(answer)) > 0),
  category text not null default 'general',
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger faqs_set_updated_at
before update on public.faqs
for each row execute function public.set_updated_at();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  blood_request_id uuid references public.blood_requests(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  donation_id uuid references public.donations(id) on delete set null,
  type public.report_type not null,
  status public.report_status not null default 'open',
  reason text not null check (char_length(trim(reason)) > 0),
  details text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_has_target check (
    reported_user_id is not null
    or blood_request_id is not null
    or message_id is not null
    or donation_id is not null
  ),
  constraint reports_review_consistent check (
    (status in ('resolved', 'dismissed') and reviewed_by is not null and reviewed_at is not null)
    or status in ('open', 'reviewing')
  )
);

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create table public.analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type public.analytics_event_type not null,
  event_name text not null check (char_length(trim(event_name)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index messages_sender_created_idx on public.messages(sender_id, created_at desc);
create index messages_recipient_created_idx on public.messages(recipient_id, created_at desc);
create index messages_blood_request_idx on public.messages(blood_request_id);
create index availability_user_starts_idx on public.availability(user_id, starts_at desc);
create index availability_status_idx on public.availability(status);
create index faqs_published_order_idx on public.faqs(is_published, display_order, category);
create index reports_reporter_created_idx on public.reports(reporter_id, created_at desc);
create index reports_status_idx on public.reports(status);
create index analytics_user_occurred_idx on public.analytics(user_id, occurred_at desc);
create index analytics_event_type_idx on public.analytics(event_type, occurred_at desc);

alter table public.messages enable row level security;
alter table public.availability enable row level security;
alter table public.faqs enable row level security;
alter table public.reports enable row level security;
alter table public.analytics enable row level security;

create policy "messages select participants admin" on public.messages
for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

create policy "messages insert sender" on public.messages
for insert to authenticated
with check (sender_id = auth.uid() or public.is_admin());

create policy "messages update recipient sender admin" on public.messages
for update to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin())
with check (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

create policy "availability select own admin" on public.availability
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "availability insert own admin" on public.availability
for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

create policy "availability update own admin" on public.availability
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "availability delete own admin" on public.availability
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "faqs select published authenticated admin" on public.faqs
for select to authenticated
using (is_published = true or public.is_admin());

create policy "faqs insert admin" on public.faqs
for insert to authenticated
with check (public.is_admin());

create policy "faqs update admin" on public.faqs
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "faqs delete admin" on public.faqs
for delete to authenticated
using (public.is_admin());

create policy "reports select reporter admin" on public.reports
for select to authenticated
using (reporter_id = auth.uid() or public.is_admin());

create policy "reports insert own" on public.reports
for insert to authenticated
with check (reporter_id = auth.uid());

create policy "reports update admin" on public.reports
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "analytics insert own anonymous" on public.analytics
for insert to authenticated
with check (user_id = auth.uid() or user_id is null);

create policy "analytics select own admin" on public.analytics
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "analytics update admin" on public.analytics
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

alter publication supabase_realtime add table public.messages;

-- Notification preference persistence + push token registry for BloodLink mobile.
-- Preferences gate in-app event creation; push_tokens store Expo push tokens when enabled.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default true,
  emergency_alerts boolean not null default true,
  message_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform = any (array['ios'::text, 'android'::text, 'web'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_key unique (token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

-- Ensure every profile has a preferences row.
create or replace function public.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_notification_preferences on public.profiles;
create trigger profiles_ensure_notification_preferences
after insert on public.profiles
for each row execute function public.ensure_notification_preferences();

insert into public.notification_preferences (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- RLS: own rows only (+ admin read)
drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
on public.notification_preferences
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
on public.notification_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
on public.notification_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own push tokens" on public.push_tokens;
create policy "Users can read own push tokens"
on public.push_tokens
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert own push tokens" on public.push_tokens;
create policy "Users can insert own push tokens"
on public.push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
on public.push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
on public.push_tokens
for delete
to authenticated
using (auth.uid() = user_id);

-- Gate in-app notification creation by preference category.
create or replace function public.create_app_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prefs public.notification_preferences%rowtype;
  v_allow boolean := true;
begin
  select * into v_prefs
  from public.notification_preferences
  where user_id = p_user_id;

  if found then
    if p_type in ('blood_request'::public.notification_type, 'donor_match'::public.notification_type, 'donation'::public.notification_type) then
      v_allow := v_prefs.emergency_alerts;
    elsif p_type = 'system'::public.notification_type and coalesce(p_data->>'category', '') = 'message' then
      v_allow := v_prefs.message_notifications;
    end if;
  end if;

  if not v_allow then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_app_notification(uuid, public.notification_type, text, text, jsonb) from public;
grant execute on function public.create_app_notification(uuid, public.notification_type, text, text, jsonb) to authenticated, service_role;

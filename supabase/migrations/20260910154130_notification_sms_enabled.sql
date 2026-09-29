-- Opt-in SMS channel for emergency app alerts (Semaphore via send-alert-sms Edge Function).
-- Default false to avoid surprise SMS cost; users enable in Settings.

alter table public.notification_preferences
  add column if not exists sms_enabled boolean not null default false;

comment on column public.notification_preferences.sms_enabled is
  'When true, eligible emergency notifications also send SMS via Semaphore (requires profiles.phone).';

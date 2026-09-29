-- When a reviewer profile is deleted, ON DELETE SET NULL clears reviewed_by while
-- status may remain approved/rejected/resolved, violating CHECK constraints.
-- Reset status before the nullification is persisted.

create or replace function public.handle_reviewer_profile_removal()
returns trigger
language plpgsql
as $$
begin
  if old.reviewed_by is not null and new.reviewed_by is null then
    if tg_table_name = 'donor_verifications' and new.status in ('approved', 'rejected') then
      new.status := 'expired';
      new.reviewed_at := null;
    elsif tg_table_name = 'bloodbank_verifications' and new.status in ('approved', 'rejected') then
      new.status := 'pending';
      new.reviewed_at := null;
    elsif tg_table_name = 'reports' and new.status in ('resolved', 'dismissed') then
      new.status := 'open';
      new.reviewed_at := null;
      new.resolution_notes := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists donor_verifications_reviewer_removal_guard on public.donor_verifications;
create trigger donor_verifications_reviewer_removal_guard
before update on public.donor_verifications
for each row execute function public.handle_reviewer_profile_removal();

drop trigger if exists bloodbank_verifications_reviewer_removal_guard on public.bloodbank_verifications;
create trigger bloodbank_verifications_reviewer_removal_guard
before update on public.bloodbank_verifications
for each row execute function public.handle_reviewer_profile_removal();

drop trigger if exists reports_reviewer_removal_guard on public.reports;
create trigger reports_reviewer_removal_guard
before update on public.reports
for each row execute function public.handle_reviewer_profile_removal();

-- Reports that only target a deleted user would violate reports_has_target after SET NULL.
create or replace function public.handle_reported_user_profile_removal()
returns trigger
language plpgsql
as $$
begin
  if old.reported_user_id is not null
    and new.reported_user_id is null
    and new.blood_request_id is null
    and new.message_id is null
    and new.donation_id is null
  then
    delete from public.reports where id = old.id;
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_reported_user_removal_guard on public.reports;
create trigger reports_reported_user_removal_guard
before update on public.reports
for each row execute function public.handle_reported_user_profile_removal();

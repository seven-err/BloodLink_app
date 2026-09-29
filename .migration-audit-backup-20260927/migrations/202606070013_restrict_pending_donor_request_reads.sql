-- Pending donors may respond to open requests via the feed view only.
-- Full blood_requests rows (patient, hospital, contact) are readable after acceptance.

create or replace function public.is_matched_donor_for_request(
  request_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donor_matches dm
    where dm.request_id = is_matched_donor_for_request.request_id
      and dm.donor_id = user_id
      and dm.status in ('accepted', 'completed')
  );
$$;

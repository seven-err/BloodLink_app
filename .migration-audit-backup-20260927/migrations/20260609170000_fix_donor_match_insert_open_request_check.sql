-- Donor match insert policy must not read blood_requests under caller RLS.
-- Unmatched donors cannot SELECT blood_requests rows, so EXISTS subqueries fail.

create or replace function public.is_open_blood_request(request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blood_requests br
    where br.id = is_open_blood_request.request_id
      and br.status = 'open'
  );
$$;

grant execute on function public.is_open_blood_request(uuid) to authenticated;

drop policy if exists "donor matches insert donor response" on public.donor_matches;

create policy "donor matches insert donor response" on public.donor_matches
for insert to authenticated
with check (
  donor_id = auth.uid()
  and public.is_donor(auth.uid())
  and public.is_open_blood_request(request_id)
);

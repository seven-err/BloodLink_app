-- Allow donors to respond to open blood requests by inserting their own donor_matches row.
-- Complements blood_requests RLS: matched donors (including pending) may read full request details.

create policy "donor matches insert donor response" on public.donor_matches
for insert to authenticated
with check (
  donor_id = auth.uid()
  and exists (
    select 1
    from public.blood_requests br
    where br.id = donor_matches.request_id
      and br.status = 'open'
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'donor'
  )
);

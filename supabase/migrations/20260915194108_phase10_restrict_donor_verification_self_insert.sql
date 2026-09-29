-- Phase 10: donors may submit pending verification docs only; cannot self-approve.
-- Admin remains the only client role that can UPDATE verification status.

drop policy if exists "donor verifications insert own" on public.donor_verifications;
drop policy if exists "donor verifications insert own pending" on public.donor_verifications;

create policy "donor verifications insert own pending"
  on public.donor_verifications
  for insert
  to authenticated
  with check (
    donor_id = auth.uid()
    and status = 'pending'::public.donor_verification_status
    and reviewed_by is null
    and reviewed_at is null
  );

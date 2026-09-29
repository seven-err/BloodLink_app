-- Force admin approve/reject through review_bloodbank_verification (SECURITY DEFINER).
-- Table UPDATE remains only for rejected→pending owner resubmits.

drop policy if exists "bloodbank_verifications update own resubmit" on public.bloodbank_verifications;

create policy "bloodbank_verifications update own resubmit"
on public.bloodbank_verifications
for update to authenticated
using (
  profile_id = auth.uid()
  and status = 'rejected'
)
with check (
  profile_id = auth.uid()
  and status = 'pending'
);

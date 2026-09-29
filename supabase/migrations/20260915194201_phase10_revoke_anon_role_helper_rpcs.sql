-- Phase 10: role-check helpers are for RLS/internal use; do not expose to anon.
revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_admin(uuid) from anon;
grant execute on function public.is_admin(uuid) to authenticated;

revoke all on function public.is_bloodbank(uuid) from public;
revoke all on function public.is_bloodbank(uuid) from anon;
grant execute on function public.is_bloodbank(uuid) to authenticated;

revoke all on function public.is_bloodbank_verified(uuid) from public;
revoke all on function public.is_bloodbank_verified(uuid) from anon;
grant execute on function public.is_bloodbank_verified(uuid) to authenticated;

revoke all on function public.is_donor(uuid) from public;
revoke all on function public.is_donor(uuid) from anon;
grant execute on function public.is_donor(uuid) to authenticated;

revoke all on function public.is_donor_profile_ready(uuid) from public;
revoke all on function public.is_donor_profile_ready(uuid) from anon;
grant execute on function public.is_donor_profile_ready(uuid) to authenticated;

revoke all on function public.is_donor_verification_active(uuid) from public;
revoke all on function public.is_donor_verification_active(uuid) from anon;
grant execute on function public.is_donor_verification_active(uuid) to authenticated;

revoke all on function public.is_matched_donor_for_request(uuid, uuid) from public;
revoke all on function public.is_matched_donor_for_request(uuid, uuid) from anon;
grant execute on function public.is_matched_donor_for_request(uuid, uuid) to authenticated;

revoke all on function public.is_open_blood_request(uuid) from public;
revoke all on function public.is_open_blood_request(uuid) from anon;
grant execute on function public.is_open_blood_request(uuid) to authenticated;

revoke all on function public.users_share_request_context(uuid, uuid) from public;
revoke all on function public.users_share_request_context(uuid, uuid) from anon;
grant execute on function public.users_share_request_context(uuid, uuid) to authenticated;

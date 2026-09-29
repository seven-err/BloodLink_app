-- Phase 4 QR security regression: revoke leftover anon EXECUTE on donation RPCs.
-- Auth checks still exist inside each function; this closes unauthenticated RPC entry.

revoke all on function public.get_donation_qr_token(uuid) from public;
revoke all on function public.get_donation_qr_token(uuid) from anon;
grant execute on function public.get_donation_qr_token(uuid) to authenticated;

revoke all on function public.ensure_donation_for_accepted_match(uuid) from public;
revoke all on function public.ensure_donation_for_accepted_match(uuid) from anon;
grant execute on function public.ensure_donation_for_accepted_match(uuid) to authenticated;

revoke all on function public.verify_donation_qr(uuid, text) from public;
revoke all on function public.verify_donation_qr(uuid, text) from anon;
grant execute on function public.verify_donation_qr(uuid, text) to authenticated;

revoke all on function public.complete_verified_donation(uuid, text, integer, text) from public;
revoke all on function public.complete_verified_donation(uuid, text, integer, text) from anon;
grant execute on function public.complete_verified_donation(uuid, text, integer, text) to authenticated;

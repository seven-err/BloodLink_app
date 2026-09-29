-- Historical remote migration reconstructed from the final live ACL.
revoke all on function public.set_donation_status(uuid, public.donation_status) from public;
revoke all on function public.set_donation_status(uuid, public.donation_status) from anon;
grant execute on function public.set_donation_status(uuid, public.donation_status) to authenticated;

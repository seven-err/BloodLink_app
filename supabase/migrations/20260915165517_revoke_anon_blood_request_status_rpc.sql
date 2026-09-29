-- Ensure set_blood_request_status cannot be executed by anon.
-- Auth check inside the function is defense in depth; EXECUTE should be staff-session only.

revoke all on function public.set_blood_request_status(uuid, public.blood_request_status) from public;
revoke all on function public.set_blood_request_status(uuid, public.blood_request_status) from anon;
grant execute on function public.set_blood_request_status(uuid, public.blood_request_status) to authenticated;

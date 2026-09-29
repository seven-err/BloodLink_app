-- The donor history and QR detail queries select bloodbank_id, which was added
-- after SELECT on donations had been restricted to an explicit safe column
-- list. Without this column grant, PostgreSQL rejects the entire query before
-- the existing row-level policies can return the user's permitted donations.

grant select (bloodbank_id) on table public.donations to authenticated;


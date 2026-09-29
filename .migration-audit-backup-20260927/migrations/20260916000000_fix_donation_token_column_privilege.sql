-- ============================================================================
-- Fix: donations.verification_token still readable by clients.
--
-- Migration 20260915000000 (ISSUE 6) attempted to hide the QR verification
-- token with:
--     revoke select (verification_token) on public.donations from authenticated;
-- but this was INEFFECTIVE. The `donations` table still carried a legacy
-- TABLE-LEVEL `GRANT SELECT` to `authenticated` (and `anon`) from the old
-- auto-expose default. In PostgreSQL a column-level REVOKE cannot override a
-- table-wide SELECT grant, so every column -- including verification_token --
-- remained selectable by any authenticated user with row access (notably the
-- requester/recipient via the donations SELECT RLS policy), letting them read
-- the donor's secret token and forge a QR code.
--
-- Correct approach: drop the table-wide SELECT and re-grant SELECT only on the
-- non-secret columns. The mobile client already selects explicit column lists
-- (never `*`) and fetches the token via the get_donation_qr_token RPC, so this
-- does not break any legitimate workflow.
--
-- Idempotent.
-- ============================================================================

-- Remove the blanket table-level SELECT that implicitly exposed every column.
revoke select on public.donations from authenticated;
revoke select on public.donations from anon;

-- Re-grant SELECT on every column EXCEPT verification_token.
grant select (
  id, match_id, donor_id, request_id, status, scheduled_at, completed_at,
  units_donated, notes, created_at, updated_at
) on public.donations to authenticated;

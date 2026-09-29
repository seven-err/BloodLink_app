-- Phase 7 follow-up: assert_bloodbank_inventory_target is internal-only.
-- Inventory RPCs call it as SECURITY DEFINER owner; clients must not invoke it.

revoke all on function public.assert_bloodbank_inventory_target(uuid) from public;
revoke all on function public.assert_bloodbank_inventory_target(uuid) from anon;
revoke all on function public.assert_bloodbank_inventory_target(uuid) from authenticated;

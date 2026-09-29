-- Phase 7 follow-up: revoke legacy broad grants on inventory tables.
-- RLS remains enabled; authenticated may SELECT only. Mutations via RPCs.

revoke all on table public.blood_inventory from anon;
revoke all on table public.blood_inventory from public;
revoke all on table public.blood_inventory_adjustments from anon;
revoke all on table public.blood_inventory_adjustments from public;

grant select on table public.blood_inventory to authenticated;
grant select on table public.blood_inventory_adjustments to authenticated;

revoke insert, update, delete on table public.blood_inventory from authenticated;
revoke insert, update, delete on table public.blood_inventory_adjustments from authenticated;

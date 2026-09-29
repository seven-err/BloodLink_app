# Supabase migration reconciliation plan

Snapshot: 2026-09-27. This is a read-only plan. No migration repair, database push, reset, or production-data mutation was performed.

## Current state

- Local and remote history match through `20260816170000`.
- The remote project then uses deployment-time timestamps while the repository mostly uses planned/canonical timestamps.
- The repository contains two different files with version `20260916000000`; this duplicate local version must be resolved before any push or repair.
- `20260927141132_donor_pre_screening_questionnaire.sql` is local-only and must remain unapplied until reconciliation is complete and the migration passes local pgTAP.

## Remote canonical migration -> local equivalent -> action

| Remote history | Local equivalent | Required action |
|---|---|---|
| `20260910154130 notification_sms_enabled` | `202609100001_notification_sms_enabled.sql` | Compare stored remote statements to the local file, then repair the local version as applied only if equivalent. |
| `20260915160906 web_admin_security_hardening` | `20260915000000_web_admin_security_hardening.sql` | Compare statements, then map/repair if exact. |
| `20260915162128 phase1_web_auth_test_fixtures` + `20260915163651 phase1_cleanup_test_fixtures` | No durable local migration should recreate these temporary fixtures. | Preserve as remote-only historical entries; do not manufacture local fixture migrations. |
| `20260915163102 fix_donation_token_column_privilege` | `20260916000000_fix_donation_token_column_privilege.sql` | Resolve the duplicate `20260916000000` filename first; compare, then map. |
| `20260915164854 staff_blood_request_status_transitions` | `20260916000000_staff_blood_request_status_transitions.sql` | Resolve the duplicate version first; compare, then map. |
| `20260915165517 revoke_anon_blood_request_status_rpc` | `20260916000100_revoke_anon_blood_request_status_rpc.sql` | Compare, then map. |
| `20260915171834` through `20260915182818` donation, blood-bank review, and inventory migrations | Local `20260916000200` through `20260916000900` with matching names | Compare each stored statement set, then map one-to-one. |
| `20260915184823 admin_predictive_analytics` + `20260915185534 ...service_role_grant` | `20260915184616_admin_predictive_analytics.sql` and/or consolidated `20260916001000_admin_predictive_analytics.sql` | Determine which local file represents the final live definition; do not mark both blindly. |
| No remote history row; live moderation objects exist | `20260916001100_admin_moderation_reports.sql` | Live enum, table columns, indexes, RLS policy, absence of direct report UPDATE policy, RPC bodies, search paths, and grants match. Candidate to mark applied after a final diff/review. |
| `20260915194028`, `20260915194108`, `20260915194201` | Local `20260916001200`, `20260916001300`, `20260916001400` | Compare, then map one-to-one. |
| `20260915204234 fix_uat_auth_null_token_columns` | Same local version/name | Already aligned. |
| `20260916143502 fix_signup_donor_map_guard` | `20260916143433_fix_signup_donor_map_guard.sql` | Compare, then map. |
| `20260916144043 require_role_setup_onboarding` | `20260916143930_require_role_setup_onboarding.sql` | Compare, then map. |
| `20260916170427 conversation_names_own_request_guard` | `20260917010000_conversation_names_own_request_guard.sql` | Compare, then map. |
| `20260916200529`, `20260916200955`, `20260916202120` emergency-alert sequence | Consolidated/local `20260917120000_broadcast_emergency_alert.sql` | Compare final live function to the consolidated local definition; map only after equivalence is proven. |
| `20260916212046 blood_request_create_cooldown` | `20260917130100_blood_request_create_cooldown.sql` | Compare, then map. |
| `20260916212156 allow_requester_accept_decline_pending_match` | `20260916212059_allow_requester_accept_decline_pending_match.sql` | Compare, then map. |
| `20260916212534 blood_request_owner_edit` | `20260917130200_blood_request_owner_edit.sql` | Compare, then map. |
| No remote history row; live verified-completion objects exist | `20260917140000_verify_donation_completion.sql` | Live guard functions, completion trigger/function body, trigger definition, search paths, and restricted trigger-function grant match. Candidate to mark applied after final diff/review. |
| No equivalent live state | `20260927141132_donor_pre_screening_questionnaire.sql` | New migration. Apply only after all history reconciliation and local behavioral tests pass. |

## Three suspected ghost migrations

### `20260827000000_ensure_all_donors_visible_on_map.sql` — do not mark applied

The live schema is materially different:

- `profiles.visible_on_map` defaults to `false`, while the local migration sets it to `true`.
- The live `nearby_map_donors` function requires `auth.uid() is not null`; the local migration omits this guard.
- Remote history shows the live result came from `20260609140000`, `20260915194028`, and `20260916143502`, not from an unrecorded equivalent of `20260827000000`.
- The local migration also contains a production-data backfill that cannot be inferred as safely applied from object existence.

Action: retire or replace this local migration with a migration that represents the intended secure final state. Never repair `20260827000000` as applied in its current form.

### `20260916001100_admin_moderation_reports.sql` — candidate to mark applied

The live enum values, audit table columns and indexes, RLS policy, report UPDATE-policy removal, three RPC definitions, search paths, and grants match the local migration. No remote history statement contains `report_moderation_actions`, indicating the objects were applied outside recorded migration history.

Action: after a final schema diff and backup/change window, mark this one local version applied; do not execute its DDL again.

### `20260917140000_verify_donation_completion.sql` — candidate to mark applied

The live donation/match guard definitions, `record_verified_donation_completion`, its restricted EXECUTE ACL, and `donations_record_verified_completion` trigger match the local migration. No remote history statement contains that completion trigger, indicating an unrecorded/manual application.

Action: after a final schema diff and backup/change window, mark this one local version applied; do not execute its DDL again.

## Proposed safe sequence

1. Commit/back up both repositories and export the remote migration history and schema definitions.
2. Resolve the duplicate local `20260916000000` versions without changing remote state.
3. Retire/replace the non-equivalent `20260827000000` migration.
4. Complete statement-by-statement mapping for every remaining remote/local timestamp pair above.
5. In a controlled window, run only the reviewed migration-history repairs for proven-equivalent objects (`20260916001100` and `20260917140000` are current candidates).
6. Re-run `supabase migration list --linked`; it must show an unambiguous linear history.
7. Start a local Supabase stack, apply all migrations from scratch, and run pgTAP.
8. Review the generated SQL diff and database advisors; resolve findings.
9. Deploy the pre-screening migration to staging first, never directly to production.
10. Run staging RLS/RPC tests with donor, recipient, admin, associated blood-bank, unassociated blood-bank, and anonymous sessions.
11. Run donor submission -> associated QR claim -> staff detail/review -> review-history -> donation completion end to end.
12. Only after staging acceptance, schedule production deployment with backup and rollback instructions. UAT eligibility comes after the deployed end-to-end checks, not before.

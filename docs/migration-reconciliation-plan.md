# Supabase migration reconciliation and staging plan

Snapshot: 2026-09-27. This audit changed local migration filenames and added historical placeholders only. It did not repair remote migration metadata, push schema changes, reset a database, deploy staging, or deploy production.

## Backup and canonical history

Recoverable backup: `.migration-audit-backup-20260927/` containing the pre-audit `supabase/migrations/`, `supabase/config.toml`, and this plan. Retired non-equivalent files are under `retired/`.

The linked inventory now has aligned local/remote timestamps for all durable remote migrations. Duplicate local version `20260916000000` was resolved as follows:

- `fix_donation_token_column_privilege` -> `20260915163102_fix_donation_token_column_privilege.sql`
- `staff_blood_request_status_transitions` -> `20260915164854_staff_blood_request_status_transitions.sql`

Other planned timestamps were renamed to their corresponding remote deployment timestamps. Four remote-only/unrecoverable versions are represented by explicit non-schema historical placeholders so the CLI can validate complete local history: temporary auth fixtures (`20260915162128`, `20260915163651`) and emergency-alert intermediate definitions (`20260916200955`, `20260916202120`). They are not repairs and are not remote executions. No remote state changed.

The only local-only versions are `20260916001100_admin_moderation_reports.sql`, `20260917140000_verify_donation_completion.sql`, and the intentional new `20260927141132_donor_pre_screening_questionnaire.sql`.

## Map visibility classification

`20260827000000_ensure_all_donors_visible_on_map.sql` is **not safe to mark applied** and was retired from the active migration directory. Live read-only checks showed `profiles.visible_on_map` remains default `false`, unlike the local file's `true` default/backfill, and live `nearby_map_donors` includes the signed-in-caller guard absent from the local file. Later remote migrations provide the secure live behavior. Classification: functionally replaced by later remote migrations; no repair and no new map reconciliation migration is required.

## Ghost classifications

`20260916001100_admin_moderation_reports.sql`: **safe to mark applied after final operator review**. Live evidence includes the expected audit table columns/defaults/foreign keys, both indexes, RLS, admin-only select policy, realtime publication membership, absent reports-admin-update policy, and matching `submit_report`, `review_report`, and `warn_reported_user` bodies with `SECURITY DEFINER` and `search_path=public`. Repair changes migration metadata only; it does not execute DDL or data changes.

`20260917140000_verify_donation_completion.sql`: **safe to mark applied after final operator review**. Live evidence includes matching donation/match guards, `record_verified_donation_completion`, restricted trigger-function ACL, and `donations_record_verified_completion` trigger. Repair changes migration metadata only.

## Migration repairs executed

Executed successfully on 2026-09-28:

```powershell
supabase migration repair --linked --status applied 20260916001100 20260917140000
```

The CLI confirmed both versions were repaired as `applied`.

Do not repair `20260827000000` or `20260927141132`.

## Dry-run results

`supabase migration list --linked` is now aligned through the repaired ghost versions; only `20260927141132` remains intentionally local-only. `supabase db diff --from migrations --to linked --schema public,storage` could not run because Docker Desktop is unavailable.

Before repair, the read-only `supabase db push --linked --include-all --dry-run` proposed exactly:

- `20260916001100_admin_moderation_reports.sql`
- `20260917140000_verify_donation_completion.sql`
- `20260927141132_donor_pre_screening_questionnaire.sql`

After repair, the ordinary `supabase db push --linked --dry-run` proposed only:

- `20260927141132_donor_pre_screening_questionnaire.sql`

## Pre-screening readiness

`20260927141132_donor_pre_screening_questionnaire.sql` contains RPC-only donor submission, acknowledgement enforcement, a client-immutable questionnaire history boundary, `donations.bloodbank_id`, associated verified-blood-bank detail access, metadata-only admin summary access, append-only review insertion through an RPC, direct client write revocations, safe `SECURITY DEFINER` search paths, and no anon execution grants. It is not database-security validated until the pgTAP suite passes.

## Local pgTAP plan

Docker/Podman is unavailable. Once available:

```powershell
supabase start
supabase db reset
supabase test db supabase/tests/donor_pre_screenings_rls_test.sql
```

The test declares `plan(32)`. Inspect all failures, fix only after review, and rerun the full suite. Do not mark security validated before a passing run.

## Staging plan — prepare only

1. Backup/export staging where applicable and verify the staging project identity.
2. Run migration list and dry run; confirm no historical replay.
3. Apply only reviewed pending migrations.
4. Verify pre-screening objects, grants, policies, RPCs, and `donations.bloodbank_id`.
5. Run anonymous and role-specific RLS/RPC checks.
6. Use isolated accounts for Donor A/B, Recipient, Verified Blood Bank A/B, and Admin.
7. Run Donor A signup/profile/pre-screening/acknowledgement/RPC/onboarding/home/status-card flow.
8. Run donation/request, QR association, Blood Bank A detail/review, and immutable review-history flow.
9. Confirm Blood Bank B, Recipient, Donor B, and anonymous access are denied; Admin sees metadata only; direct donor INSERT/UPDATE/DELETE are denied; final eligibility remains independent.
10. Regression-check matching, availability, QR completion, inventory, blood requests, and recipient onboarding.

## Remaining blockers

- Migration-history repairs are complete; the pre-screening migration has not been pushed.
- Docker/Podman is unavailable; local pgTAP and schema diff are pending.
- Staging backup, identity verification, deployment, and E2E validation are pending.
- The project is **not READY FOR UAT**. Production deployment and production-data changes remain out of scope.

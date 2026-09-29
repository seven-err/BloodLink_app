-- Repair Auth scan failures for manually provisioned UAT users.
-- Supabase Auth expects empty strings (not NULL) in these columns.
-- See: https://supabase.com/docs/guides/troubleshooting/auth-error-500-database-error-querying-schema-eb6b44

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, '')
WHERE email IN ('uat-admin@bloodlink.ph', 'uat-bloodbank@bloodlink.ph')
  AND (
    confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change IS NULL
    OR email_change_token_new IS NULL
  );

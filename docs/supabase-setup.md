# BloodLink Supabase Backend Setup

This guide implements Task 1.2 for a manually created Supabase project.

## 1. Create the Supabase project

1. Open the Supabase dashboard.
2. Create a new project named `BloodLink`.
3. Select the Singapore region.
4. Save the project URL and anon public key.

## 2. Configure local environment

1. Copy `.env.example` to `.env.local`.
2. Fill these values:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_NOMINATIM_URL`
   - `EXPO_PUBLIC_OSRM_URL`
   - `EXPO_PUBLIC_OSM_USER_AGENT`
3. Keep `.env.local` private. It is ignored by Git.

## 3. Enable authentication

In Supabase Dashboard > Authentication > Providers:

1. Enable Email provider.
2. Enable **Confirm email**. BloodLink expects confirmation before creating a session.
3. Enable Phone provider (no Twilio required when using the Send SMS Hook below).
4. Enable Google provider (Web client ID + optional iOS/Android client IDs from Google Cloud Console).
5. Configure Brevo email delivery (section 3a), then PhilSMS delivery (section 3b).

### 3a. Brevo SMTP (email confirmation)

Supabase Auth—not the Expo client—must send sign-up confirmation messages through Brevo. Do not put the Brevo SMTP key in the app or in any `EXPO_PUBLIC_*` variable.

1. In Brevo, open **Settings > Senders, Domains & Dedicated IPs**:
   - Add a sender such as `no-reply@your-domain.example`.
   - Authenticate the sender domain with Brevo's DKIM and DMARC DNS records.
   - Wait until Brevo shows the domain and sender as authenticated.
2. In Brevo, open **Settings > SMTP & API > SMTP**:
   - Generate a standard SMTP key named `BloodLink Supabase Auth`.
   - Copy it immediately; Brevo only shows the complete key once.
   - Copy the displayed **SMTP login** separately. It may differ from the Brevo account email.
3. In Supabase Dashboard, open **Authentication > Emails > SMTP Settings** and enable custom SMTP:
   - Sender email: the verified Brevo sender from step 1
   - Sender name: `BloodLink`
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: the Brevo SMTP login
   - Password: the Brevo SMTP key (not a Brevo API key)
4. In **Authentication > Sign In / Providers > Email**, keep **Confirm email** enabled.
5. In **Authentication > URL Configuration**, keep these redirect URLs:
   - `bloodlink://auth/email-confirmed`
   - `bloodlink://auth/reset-password`
   - `bloodlink://**`
   - `exp://**/auth/email-confirmed`
   - `exp://**/auth/reset-password`
   - `http://localhost:8081/**` (development only)
6. In **Authentication > Email Templates > Confirm signup**, keep both variables in the message:
   - Confirmation button URL: `{{ .ConfirmationURL }}`
   - Fallback code: `{{ .Token }}`
7. In Brevo transactional settings, disable click/link tracking for authentication mail so the single-use Supabase confirmation URL is not rewritten.

#### End-to-end verification

Use a new email address (or delete only the disposable test user first), then:

1. Sign up in BloodLink.
2. Confirm Supabase returns a user with no session and the app opens **Verify email**.
3. In Brevo **Transactional > Logs**, confirm the message is `Delivered`.
4. Open the message and confirm the sender domain passes DKIM/DMARC in the mailbox's message details.
5. Click the confirmation button and verify BloodLink opens the email-confirmed flow.
6. Repeat with another test address and enter the 8-digit fallback code instead of clicking the link.
7. If a message is absent, inspect **Supabase > Logs > Auth** first, then the Brevo transactional log. Supabase errors mean handoff/configuration failed; a Brevo delivery/bounce status means the message reached Brevo and must be diagnosed there.

### 3b. PhilSMS (Send SMS Hook + app alerts)

BloodLink sends phone OTPs through a Supabase Edge Function (`send-sms`) that calls [PhilSMS](https://dashboard.philsms.com/developers/docs). Opt-in emergency SMS alerts (blood requests, matches, donations) go through `send-alert-sms`, triggered by a Database Webhook on `public.notifications` INSERT.

**Dashboard quirk:** Phone provider save can require Twilio fields even when using the SMS Hook ([supabase#45198](https://github.com/supabase/supabase/issues/45198)). Use this order:

1. Keep **Send SMS Hook disabled** for a moment.
2. Authentication → Providers → Phone:
   - Enable Phone
   - SMS provider: Twilio
   - Enter dummy-but-valid placeholders (not real Twilio — unused at runtime):
     - Account SID: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - Auth Token: any non-empty string
     - Message Service SID: `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Save
3. Authentication → Hooks → **Send SMS**:
   - Enable HTTPS hook
   - URL: `https://qyfmmjxxttncmyetxczf.supabase.co/functions/v1/send-sms`
   - Generate / copy secret (`v1,whsec_...`)
4. Set Edge Function secrets (API token from [PhilSMS dashboard](https://dashboard.philsms.com/)):

```bash
npx supabase secrets set --project-ref qyfmmjxxttncmyetxczf \
  PHILSMS_API_TOKEN=your_philsms_api_token \
  PHILSMS_SENDER_ID=PhilSMS \
  SEND_SMS_HOOK_SECRET=v1,whsec_xxx \
  ALERT_SMS_SECRET=generate_a_long_random_secret
```

`PHILSMS_SENDER_ID` must be an approved alphanumeric sender ID (max 11 characters).

5. Deploy both functions:

```bash
npx supabase functions deploy send-sms --project-ref qyfmmjxxttncmyetxczf
npx supabase functions deploy send-alert-sms --project-ref qyfmmjxxttncmyetxczf
```

6. Database → Webhooks → create webhook:
   - Table: `public.notifications`
   - Events: **Insert**
   - Type: HTTP Request
   - URL: `https://qyfmmjxxttncmyetxczf.supabase.co/functions/v1/send-alert-sms`
   - HTTP Headers: `x-alert-sms-secret` = same value as `ALERT_SMS_SECRET`
   - Timeout: leave default

7. Apply migration `202609100001_notification_sms_enabled.sql` (adds `notification_preferences.sms_enabled`, default `false`). Users opt in under Settings → SMS Alerts (requires `profiles.phone`).

**Alert rules (enforced in `send-alert-sms`):**

- Types: `blood_request`, `donor_match`, `donation` only
- `blood_request`: SMS only when `data.urgency` is `critical` or `high`
- User must have `sms_enabled = true` and a non-empty `profiles.phone`

Never put `PHILSMS_API_TOKEN`, `ALERT_SMS_SECRET`, or `SEND_SMS_HOOK_SECRET` in `EXPO_PUBLIC_*` env vars.

With the Auth hook enabled, Auth ignores Twilio and delivers OTPs via `send-sms` (PhilSMS).

### Google Sign-In

Android and iOS use the native Google account picker when the Google Sign-In module is in the binary. Web still uses browser OAuth. Native Android sign-in requires an Android OAuth client with package `com.sevenerr.BloodLink` and the SHA-1 of the keystore that signed the installed APK (EAS preview, production, and debug certificates are different).

1. In [Google Cloud Console](https://console.cloud.google.com/auth/clients), create:
   - **Web application** OAuth client (required — Supabase Google provider + ID tokens)
   - **Android** OAuth client — package `com.sevenerr.BloodLink` and the SHA-1 of the keystore that signed the APK
   - **iOS** OAuth client — bundle ID `com.sevenerr.BloodLink` (optional; iOS falls back to browser OAuth)
2. Authorized redirect URI on the **Web** client (for Supabase):
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase Dashboard > Authentication > Providers > Google:
   - Enable Google
   - Paste Web client ID + secret
   - Add the iOS client ID if you use the native iOS picker
   - Enable **Skip nonce check** for native iOS ID-token sign-in
4. App env (`.env` / `.env.local`):
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = Web client ID
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` = iOS client ID (optional)
   - `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` = reversed iOS client ID, e.g. `com.googleusercontent.apps.1234-abcd`
5. A preview APK that already includes `@react-native-google-signin/google-signin` can pick up the native flow with `eas update --channel preview`. A new APK is only required if that native module is missing from the installed binary.

Web redirect allow list (Authentication > URL Configuration):

- **Site URL:** `http://localhost:8081` (not `:3000` — wrong Site URL causes “cannot reach localhost”)
- `http://localhost:8081/**`
- `bloodlink://**`
- `exp://**`

Password recovery uses `bloodlink://auth/reset-password` / `exp://.../auth/reset-password` on device. In Expo web, the app uses the current web origin (localhost during development) and shows the **Choose a new password** screen. Send reset emails from BloodLink's **Forgot Password?** action so the app supplies the correct redirect; links created directly from the Supabase dashboard use the configured Site URL and may point to an old localhost address. Email confirmation uses a native deep link (`bloodlink://` / `exp://`) on device, or `http://localhost:8081/?email_confirmed=1` on Expo web. Resend the confirmation or reset email after changing Redirect URLs — old links keep the previous address.

The app client stores sessions with `expo-secure-store` through `src/services/supabase/client.ts`.

## 4. Run database migration

In Supabase Dashboard > SQL Editor:

1. Run `supabase/migrations/202606040001_initial_backend.sql`.
2. Run `supabase/migrations/202606040002_phase_2_schema.sql`.
3. Run `supabase/migrations/202606040003_phase_3_profile_completion.sql`.
4. Confirm these tables exist:
   - `profiles`
   - `blood_requests`
   - `messages`
   - `notifications`
   - `notification_preferences`
   - `push_tokens`
   - `donations`
   - `availability`
   - `faqs`
   - `reports`
   - `analytics`
   - `donor_verifications`
   - `bloodbank_verifications`
   - `donor_matches`
5. Confirm `profiles.birthdate` exists for Phase 3 profile completion.
6. Confirm these relationships exist through `profiles.id`:
   - `profiles` to `donations`
   - `profiles` to `blood_requests`
   - `profiles` to `messages`
   - `profiles` to `notifications`
7. Confirm messaging is secure:
   - Only sender, recipient, or admin can read a message.
   - Only the sender or admin can create a message.
8. Confirm PostGIS is enabled.
9. Confirm RLS is enabled on all app tables.

## 5. Storage buckets

The migration creates these private buckets:

- `profile-images`
- `medical-documents`
- `blood-request-attachments`

Use owner-prefixed object paths, for example:

- `profile-images/{user_id}/avatar.jpg`
- `medical-documents/{user_id}/verification.pdf`
- `blood-request-attachments/{user_id}/{request_id}.pdf`

## 6. Realtime

The migration adds these tables to `supabase_realtime`:

- `blood_requests`
- `donor_matches`
- `notifications`

Client helpers live in `src/services/supabase/realtime.ts` and are user-scoped where possible.

## 7. OSM, Nominatim, and OSRM

Location wrappers live in `src/services/maps/osm.ts`.

Development defaults:

- Nominatim: `https://nominatim.openstreetmap.org`
- OSRM: `https://router.project-osrm.org`

For production, use compliant hosted services or self-hosted endpoints. Public OSM-family services have usage policies and should not be treated as unlimited app backend infrastructure.

## 8. Validation checklist

Run locally:

```bash
npm install
npx expo install --fix
npx tsc --noEmit
```

Manual Supabase checks:

- Email/password sign up and sign in works.
- Phone OTP request and verification works.
- User session persists after app restart.
- A user cannot read another user's private rows.
- A donor can see eligible open requests.
- A recipient can manage only their own requests.
- User notifications arrive via realtime only for that user.
- Geocoding, reverse geocoding, and route calculation return expected results.

## References

- Expo SDK 54: https://docs.expo.dev/versions/v54.0.0/
- Supabase React Native auth: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime: https://supabase.com/docs/guides/realtime/postgres-changes

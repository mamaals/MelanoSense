# Stage 5.1: APK blocker checklist

Audit date: 2026-10-28. Verdict: **NOT READY FOR PREVIEW APK BUILD**.

Follow-up: [Stage 5.2 results](stage52-sdk57-migration.md) supersede the pending
SDK migration and OAuth UI decisions in this historical checklist. SDK 57 and
hidden provider controls are complete. [Stage 5.3](stage53-android-identity.md)
records explicit application ID approval and assignment. Environment approval
and the unverified deployed-backend items below remain outstanding.

This checklist separates source evidence from deployed evidence. It does not
authorize a build, migration, EAS variable write, backend change, or Pi change.
No patient records are required. Do not copy keys, device tokens, sessions,
function secrets, or patient information into this document or reports.

## Decisions and approval status

- **Approved and assigned in Stage 5.3:** `android.package` is
  `com.ucupysteam.melanosense`. Owner, EAS project ID, scheme and `versionCode: 1`
  are retained. This approval does not authorize EAS writes or a build.
- **Approved and completed in Stage 5.2:** SDK 57 migration and Android image
  alignment, using Expo 57.0.31 with the Hermes fix. No SDK 58 upgrade.
- Confirm the intended mobile Supabase project matches the operational Pi, then
  authorize configuring only the two client-safe variables in EAS `preview`.
  Production setup remains a separate decision.
- **Approved and completed in Stage 5.2:** Google/Apple controls are hidden via
  a source flag; handlers remain intact. Email authentication is the preview scope.

## Evidence and acceptance checklist

| Check | Source evidence | Deployed evidence | Remaining acceptance evidence |
| --- | --- | --- | --- |
| Mobile/Pi project match | Mobile target is pinned in EAS configuration; Pi loads its own environment | Mobile URL/key accepted by Auth | **UNVERIFIED:** compare the operational Pi hostname locally; record match only, never its secret |
| `device-api` revision | Existing source defines POST `/pair`, `/ingest-scan`, `/disconnect` | GET returns JSON `405 method_not_allowed` | **UNVERIFIED:** inspect deployed revision/body and gateway settings through authorized dashboard access |
| Pair/ingest authorization | Require `X-Device-Secret`; resolve raw UUID profile token server-side | No POST was attempted | **UNVERIFIED:** deployed code must retain these checks; do not send a real token or device secret for this audit |
| Disconnect | Validates mobile Bearer user, rotates own profile token | No disconnect was attempted | **UNVERIFIED:** deployed source must match; behavioral test belongs to separately approved synthetic acceptance |
| `profiles`, `scans`, `devices` | Mobile own-user filters; registry migration exists | Each required-column `limit=0` REST query returns 200 and no rows | **UNVERIFIED:** live RLS, grants, constraints, and cross-account isolation |
| `scan-images` | Private-bucket migration and own-folder SELECT policy; mobile signed URLs expire after one hour | Anonymous metadata request returns 400 `NoSuchBucket` | **UNVERIFIED:** bucket existence/privacy and live Storage policies; anonymous denial does not prove absence |
| Realtime | Own-user scans INSERT observer, polling fallback and exactly-once navigation | No events or patient rows requested | **UNVERIFIED:** `supabase_realtime` publication includes scans and authenticated row authorization works |
| Signup provisioning | Integration prose describes auth-user trigger and UUID default; base trigger DDL is absent from inspected migration | Email enabled and signup not disabled in public Auth settings | **UNVERIFIED:** installed trigger/function/defaults; no signup or database write performed |
| OAuth | Scheme `melanosense`, callback route and handlers exist | Google and Apple disabled; email enabled | **UNVERIFIED:** provider setup, redirect allowlist and standalone-device callback; do not claim OAuth ready |

A successful `limit=0` request establishes exposed table/column compatibility,
not RLS correctness, isolation, or functioning profile provisioning. Source SQL
with `ON CONFLICT DO NOTHING` does not prove an existing bucket is private.

## Authorized admin inspection, read-only

These queries are prepared for the intended project's SQL editor using existing
authorized access. They have **not** been executed by this audit because no
management/database session is available. Review privately and record only
status and relevant metadata. Never add policies, triggers, grants, publications,
functions, or buckets to make this checklist pass automatically.

```sql
BEGIN TRANSACTION READ ONLY;

-- Presence and RLS flags; missing rows must be investigated, not auto-created.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE (n.nspname = 'public' AND c.relname IN ('profiles', 'scans', 'devices'))
   OR (n.nspname = 'storage' AND c.relname = 'objects');

-- Review both USING and WITH CHECK, role applicability and permissive policies.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('profiles', 'scans', 'devices'))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'scans', 'devices')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- Metadata only: never select storage.objects or scan/patient rows for this audit.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'scan-images';

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  AND tablename = 'scans';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('id', 'full_name', 'phone', 'birth_date', 'gender',
                      'device_token', 'is_currently_connected', 'device_last_seen_at')
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (to_regclass('public.profiles'), to_regclass('public.scans'),
                  to_regclass('public.devices'));

SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition,
       p.oid::regprocedure AS trigger_function, p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_trigger AS t
JOIN pg_proc AS p ON p.oid = t.tgfoid
WHERE t.tgrelid = to_regclass('auth.users') AND NOT t.tgisinternal;

COMMIT;
```

Review the installed signup function body privately in the dashboard. A trigger
name alone is insufficient: verify the auth-user-to-profile ID mapping, UUID
token/default, required-field handling, privileges, and search path. Check the
function's deployed revision and route branches privately as well. Do not export
function secrets. Catalog review establishes configuration, while synthetic
cross-account, signup, signed-image, and event-delivery behavior remains a later,
separately authorized test involving test accounts only.

## EAS preview setup after approval

Use the existing project's dashboard environment-variable page:
[MelanoSense EAS variables](https://expo.dev/accounts/ucupys-team/projects/melanosense/environment-variables).
First confirm the owner/project ID matches `app.json` and compare the mobile/Pi
Supabase hostname privately. Do not substitute a newly created Supabase project.

Create these project variables for **preview only**, using dashboard value fields
instead of a CLI `--value` argument, terminal paste, or shell history:

| Variable | Value source | Visibility |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Existing intended mobile Cloud project URL | Plaintext or Sensitive |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client-safe publishable key for that same project | Sensitive preferred |

Do not add `EXPO_PUBLIC_SUPABASE_ANON_KEY` alongside a different publishable key.
Do not use Secret visibility for values needed by local EAS config resolution.
EAS visibility does not make `EXPO_PUBLIC_*` values secret inside an APK. Never
use service-role, management/PAT, device-ingest, or other backend secrets here.
Keep production unchanged until preview has been verified and setup approved.

After authorized setup, run the existing guard without printing variable values:

```powershell
corepack pnpm exec eas env:exec preview "node scripts/validate-build-config.cjs preview" --non-interactive
```

The application ID is now configured. The Stage 5.3 preview guard still fails
because both EAS Supabase values are missing. Its negative-path tests passing
does not mean a build is ready.

## Controlled SDK 57 plan after approval

Registry review found stable `expo@57.0.31`. Recheck available SDK 57 patches at
execution time. The official notes identify `57.0.9+` / React Native `0.86.2+`
for the memory fix and `57.0.17+` / React Native `0.86.3+` for the separate
development startup fix. Do not patch Hermes manually or suppress Doctor checks.

The approved migration would use Corepack pnpm to install the selected explicit
SDK 57 Expo version, then that SDK's `expo install --fix --pnpm` to align native
dependencies, Router and tooling. Review the diff and resolve scoped regressions.
Preserve pnpm `11.23.0`, business contracts and all existing regression tests.

Review the explicit SDK 57 Android image
`ubuntu-26.04-jdk-17-ndk-r27b-sdk-57`, retaining existing Node/Corepack/pnpm pins
where compatible. Align profile regression assertions with the selected image.
Rerun tests, TypeScript, lint, resolved Expo config, Doctor, EAS JSON schema/profile
resolution, the actual preview guard, and `git diff --check`. A local validation
does not prove cloud image execution or low-RAM device performance. No native
build directories need deletion in the current managed project.

## References

- [Expo SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/)
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [SDK 57 known regressions](https://expo.dev/changelog/sdk-57#known-regressions)
- [Official upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [EAS build images](https://docs.expo.dev/build-reference/infrastructure/)
- [EAS variable management](https://docs.expo.dev/eas/environment-variables/manage/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

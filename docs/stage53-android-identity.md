# Stage 5.3: approved Android identity

Date: 2026-10-28. Android identity configuration: **complete**.
Overall verdict: **NOT READY FOR PREVIEW APK BUILD** because EAS Supabase values
and deployed backend verification remain outstanding. No build was started.

## Approved identity

The user explicitly approved `com.ucupysteam.melanosense` for `android.package`.
It is now set in `app.json` and confirmed by resolved public Expo configuration.

Preserved values: app version `1.0.0`, Android versionCode `1`, scheme
`melanosense`, owner `ucupys-team`, and EAS project ID
`54881a16-5f3a-4bdb-b182-0a199a16cc30`. Icons, adaptive icons, splash settings,
plugins and all other app configuration are unchanged from Stage 5.2.

Expo remains `57.0.31`; React Native `0.86.3`; package manager `pnpm@11.23.0`.
Google/Apple controls remain hidden. No dependency or lockfile changes were made.

## EAS environment and actual guard

The existing authenticated EAS CLI was used read-only to inspect project variables:

- `preview`: no variables configured; read succeeded.
- `production`: no variables configured; read succeeded; no setup attempted.

The actual command executed was:

```powershell
eas.cmd env:exec preview "node scripts/validate-build-config.cjs preview" --non-interactive
```

Result: **FAIL, exit 1**. Identity no longer fails. The remaining failures are
missing `EXPO_PUBLIC_SUPABASE_URL` and missing client publishable/anon key.
The guard remains unchanged and does not load local dotenv to bypass EAS setup.

Application ID approval does not authorize creating EAS variables or starting a
build. Neither action was performed. No credential values are recorded here.

## Manual preview setup, after target confirmation

1. An authorized user must privately confirm that the operational Pi's configured
   Supabase hostname matches the existing mobile project's hostname. Mobile and
   the pinned EAS target match locally; the operational Pi remains unverified.
   Do not change Pi configuration or substitute another Supabase project.
2. Open [MelanoSense EAS environment variables](https://expo.dev/accounts/ucupys-team/projects/melanosense/environment-variables).
   Verify owner/project against `app.json`. Choose project scope and **preview**.
3. Use Add Variables and Dashboard value inputs to enter the existing Cloud URL
   as `EXPO_PUBLIC_SUPABASE_URL` and that project's client-safe publishable key as
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use Plaintext or Sensitive for the URL
   and Sensitive for the key. Do not print/paste values into terminal commands,
   shell history, source, reports or chat.
4. Do not use Secret visibility for these values needed by local EAS config
   resolution. All `EXPO_PUBLIC_*` values are public in an APK regardless of EAS
   visibility. Never use service-role, management/PAT, device-ingest or other
   backend secrets. Avoid a competing `EXPO_PUBLIC_SUPABASE_ANON_KEY` variable.
5. Save for preview only using the authorized Dashboard action. Production setup
   remains separate. The agent has not performed or been authorized to perform
   these writes.
6. Rerun the preview guard below and require PASS before any build approval.

## Backend preflight evidence

The [Stage 5.1 checklist and read-only catalog queries](stage51-backend-verification.md)
remain the acceptance checklist. Fresh GET probes used the existing local
client-safe URL/key in memory; all table requests used `limit=0` and returned no
patient rows. No signup, pair, ingest, disconnect, database or policy write ran.

| Item | Fresh deployed evidence | Remaining status |
| --- | --- | --- |
| Project target | Local mobile URL matches pinned EAS hostname; public Auth settings accept the client key, HTTP 200 | Operational Pi project match **UNVERIFIED**; core checkout has no local `.env` |
| `device-api` | GET returns JSON 405 `method_not_allowed`; source still defines POST pair/ingest/disconnect contracts | Deployed revision, POST implementation and gateway settings **UNVERIFIED** |
| profiles/scans/devices | Each required-column `limit=0` query returns 200 and no rows | Live RLS/grants, constraints and isolation **UNVERIFIED** |
| scan-images | Anonymous metadata lookup returns 400 `NoSuchBucket` | Bucket existence/privacy, Storage policies and signed-image authorization **UNVERIFIED**; denial does not prove a private bucket is absent |
| Realtime scans | Existing source INSERT observer and polling remain intact | Publication membership, authorization and event delivery **UNVERIFIED** |
| Signup/profile provisioning | Email enabled, signup not disabled in public Auth settings | Installed trigger/function/defaults and end-to-end profile provisioning **UNVERIFIED** |
| Google/Apple | Both disabled in public Auth settings | UI remains hidden; provider and standalone callback acceptance remain outside preview claims |

No management token is available in the session, no Supabase connector or CLI was
available, and no authorized admin/database session could inspect catalogs. The
prepared catalog queries were not executed. Source migrations do not establish
the deployed revision or policies. Obtain authorized read-only Dashboard/SQL
inspection and record metadata statuses without credentials or patient data.

## Validation executed

- `corepack pnpm test`: **83 PASS, 0 FAIL, 0 skipped**.
- `corepack pnpm exec tsc --noEmit`: PASS.
- `corepack pnpm lint`: PASS.
- `corepack pnpm exec expo config --type public --json`: PASS, approved package
  resolved; SDK `57.0.0`, app version `1.0.0`, versionCode `1`.
- `corepack pnpm dlx expo-doctor@1.21.5 --verbose`: **21/21 PASS**.
- `git diff --check`: PASS; new document whitespace/conflict checks also pass.
- Snapshot checks: the only app config change is `android.package`; existing
  source/tests/assets, package/lockfile, EAS configuration and local env are intact.
- Actual EAS preview guard: **FAIL** for the two missing Supabase values.

## Exact steps before an approved cloud build

1. Confirm operational Pi project match, then complete the manual preview setup.
   No additional application ID approval is required.
2. Complete the authorized read-only deployed-backend checklist: function
   revision/routes, RLS/grants, Storage, Realtime and signup provisioning.
3. Rerun validation and the actual EAS environment guard:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
corepack pnpm --version
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm exec expo config --type public
corepack pnpm dlx expo-doctor@1.21.5 --verbose
git diff --check
corepack pnpm exec eas env:exec preview "node scripts/validate-build-config.cjs preview" --non-interactive
```

4. Review resolved preview APK configuration, signing requirements and any
   remaining unverified items; obtain separate explicit build approval. Only then:

```powershell
corepack pnpm exec eas build --platform android --profile preview
```

This build command has **not** been executed. Signing, native cloud execution,
standalone install, Android low-RAM performance and physical acceptance remain
unverified. Backend/Pi/schema/Edge Function/model changes: **None**.

References: [Expo SDK 57 app config](https://docs.expo.dev/versions/v57.0.0/config/app/),
[EAS variable setup](https://docs.expo.dev/eas/environment-variables/manage/).

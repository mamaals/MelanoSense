# Android build preflight

Audit date: 2026-10-28. Verdict: **NOT READY FOR APK BUILD**.

Current follow-up: [Stage 5.2 migration results](stage52-sdk57-migration.md).
SDK 57.0.31 / RN 0.86.3 migration and OAuth UI cleanup are complete; Doctor is
21/21 PASS. The SDK 56 findings below are the historical Stage 5 baseline.
Android identity follow-up: [Stage 5.3 results](stage53-android-identity.md).
The user explicitly approved `com.ucupysteam.melanosense`; it is now assigned.
EAS environment setup and deployed backend verification remain outstanding.

Stage 5.1 follow-up: [APK blocker and read-only backend checklist](stage51-backend-verification.md).
The application ID is approved and assigned. EAS writes still require separate approval.

No build, deploy, database write, policy change, signing-key creation, or Pi change
was performed. Credentials must never be copied into this document or build logs.

## Configuration prepared

- Existing EAS owner/project retained: `ucupys-team`,
  `54881a16-5f3a-4bdb-b182-0a199a16cc30`.
- App version `1.0.0`; initial Android `versionCode: 1`.
- Android application ID: **`com.ucupysteam.melanosense`**, explicitly approved
  and assigned in Stage 5.3. No build has been started by these stages.
- `preview`: internal, standalone release APK; not an Expo development client.
- `production`: store AAB, explicit production environment.
- Tooling pinned: EAS CLI `20.4.0`, Node `24.15.0`, pnpm `11.23.0`, Corepack,
  SDK 56 image `ubuntu-26.04-jdk-17-ndk-r27b`.
- Local app-version source and `autoIncrement: false`. Increment `versionCode`
  deliberately for subsequent store releases; never reuse an uploaded code.
- Credentials source is EAS remote. Signing credentials have not been inspected
  or created; the first approved interactive build may require a keystore decision.
- Existing icon, adaptive icons, splash, scheme, owner and project ID retained.
- Frozen lockfile remains enabled. No package or lockfile upgrade was performed.

These pins make the inputs explicit; they do not promise byte-identical APKs.
Remote builder maintenance, signing credentials, environment values and source
revision must also be recorded with each build.

## Environment and build guard

EAS `preview` and `production` environments were inspected through the existing
authenticated CLI session. Both had no environment variables configured.

Configure the following separately in both environments after configuration review:

| Variable | Visibility | Required value |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Plaintext or sensitive | Existing intended Supabase Cloud URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sensitive or plaintext | Client-safe publishable key for that project |

Do not use secret visibility for values that must be available to local EAS config
resolution/`env:exec`. Values embedded in a mobile binary are public regardless of
their EAS visibility. A legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` remains supported,
but use a single key variable to avoid the existing anon-first precedence.

`eas-build-pre-install` runs `scripts/validate-build-config.cjs`. It refuses a
missing/unapproved application ID, invalid versionCode, missing/placeholder URL,
URL different from `build.base.env.MELANOSENSE_SUPABASE_HOST`, non-client key,
ambiguous key variables, forbidden public backend/device credential names, or a
disabled frozen lockfile. It prints field names and errors, never values.

The hostname pin comes from the established local mobile target. Its key was
accepted by the deployed Auth endpoint. This proves the local URL/key pair is
functional; it does not prove this project is the one configured on the physical
Pi. Confirm that operational target before build approval.

Key validation in the guard checks syntax and legacy JWT claims, not signatures
or revocation. The current local key was separately checked by a read-only request.

EAS profiles set `EXPO_NO_DOTENV=1`; `.easignore` excludes local `.env*`, even if
tracked. The original local `.env` was retained unchanged. It is still tracked:
adding a Git ignore pattern does not untrack an existing file. Its current values
are client-safe; any future untracking is a separate reviewed Git operation.
`.env.example` now contains placeholders only. No key is stored in `eas.json`.

## Backend evidence

| Item | Verified from source | Verified from deployed environment | Still unverified |
| --- | --- | --- | --- |
| Profiles | Mobile reads/updates own row; four required fields | `limit=0` query validates required columns | Live RLS definitions and cross-account isolation |
| Scans | Own-user filters, completed INSERT observer, pagination | `limit=0` query validates required columns | Live RLS/publication and delivery to authenticated clients |
| Devices | Edge service upsert; device registry migration | `limit=0` query validates required columns | Live policies and constraints |
| `device-api` | POST pair/ingest secret gate; authenticated disconnect rotates token | GET endpoint returns JSON 405 | Deployed version/body, POST routes and gateway settings |
| `scan-images` | Private-bucket migration, user-folder SELECT policy, 1-hour signed URL | Metadata lookup returns `400 NoSuchBucket` to anonymous client | Bucket existence/privacy and signed URL authorization as a user |
| Signup provisioning | Existing integration document describes `handle_new_user` trigger | Email signup enabled; confirmation required | Trigger/defaults actually installed and synthetic signup provisioning |
| OAuth | Scheme/callback, Google/Apple handlers implemented | Public Auth settings show Google/Apple disabled | Provider setup, redirect allowlist, release callback |

All table probes used `limit=0` and returned no patient rows. A zero-row query
does not prove isolation. Anonymous Storage metadata failure does **not** establish
that a private bucket is missing. No patient credentials or test signup were used.

Source compatibility details:

- QR remains the raw UUID `profiles.device_token`; only Pi pairs/ingests.
- `/pair` and `/ingest-scan` require `X-Device-Secret`; mobile never has it.
- `/disconnect` validates the mobile Bearer session and rotates the account token.
- Image paths are `<user-id>/<random-uuid>.jpg`; mobile creates a signed URL.
- Edge ingestion defaults to `completed`, writes ABCD/stage when supplied and
  inserts after image handling; mobile waits for a new completed row.
- `recommendation` is read by mobile but not populated by the inspected Edge
  implementation; nullable formatting remains intentional.
- Inspected pair/ingest handlers touch the device registry but do not explicitly
  set profile connection flags. Any deployed trigger maintaining those flags is
  unverified; the mobile intentionally treats them as information, not a hard gate.
- Older integration prose says ABCD/stage are not sent and describes direct token
  rotation. Current executable Edge/mobile source takes precedence over that prose.
- Required base profile/scan policies, provisioning trigger and Realtime
  publication DDL are not present in the inspected migration. Documentation is
  evidence of intended behavior, not proof of current deployment.

No Supabase Management API credential or connected dashboard was available.
Authorized project-admin read-only inspection is needed for function version,
policies, bucket metadata, signup trigger/defaults and Realtime publication. Do not
paste management/service/device secrets into the repository, reports or chat.

## Standalone OAuth

The standalone redirect expected from the existing scheme is
`melanosense://auth/callback`. Keep the callback route outside the protected stack.
Google/Apple must be enabled and configured in Supabase before they can work.
Verify that exact redirect in the Supabase allowlist. Provider-side redirects to
Supabase's `/auth/v1/callback` and the mobile return URL are different settings.
Provider credentials, allowlist and release-device callback were not changed.

## Expo Doctor and Hermes

`corepack pnpm dlx expo-doctor@1.21.5 --verbose` uses a disposable tool; it does not
add a project dependency. The audit found 20/22 checks passing, with two failures:

1. Expo `56.0.21` uses affected Hermes V1 `250829098.0.10`. Doctor identifies
   `250829098.0.16` as the first fixed engine. Official Expo documentation places
   the supported fix in SDK 57 / Expo `57.0.9+` / React Native `0.86.2+`.
   No documented supported SDK 56 in-place fix was identified. Experimental
   worklets bundle mode and engine overrides were not applied.
2. Seven patch mismatches: expo, expo-constants, expo-image, expo-linking,
   expo-router, expo-sharing and expo-splash-screen. No versions were changed and
   no Doctor checks were excluded or suppressed.

This is a release concern on low-RAM Android: memory pressure, GC/jank or process
termination may occur. Actual MelanoSense impact is unmeasured. An explicit
dependency/migration decision and release-device profiling remain necessary.
The separate development startup regression is not described as affecting
production builds in Expo's release notes.

References:

- [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/)
- [EAS configuration](https://docs.expo.dev/eas/json/)
- [EAS environment variables](https://docs.expo.dev/eas/environment-variables/)
- [Build images](https://docs.expo.dev/build-reference/infrastructure/)
- [SDK 56 regressions](https://expo.dev/changelog/sdk-56#known-regressions)
- [SDK 57 fixes](https://expo.dev/changelog/sdk-57#known-regressions)
- [Supabase client-safe keys](https://supabase.com/docs/guides/getting-started/api-keys)

## Commands after review and approval

The approved `android.package` is set and Stage 5.2 resolved the Doctor findings.
First resolve the backend/security review items and configure approved EAS
variables. The following commands are for the
existing installed EAS CLI 20.4.0 and do not include credential values:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
corepack pnpm --version
corepack pnpm exec eas --version
corepack pnpm exec eas whoami
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm exec expo config --type public
git diff --check
corepack pnpm exec eas env:exec preview "node scripts/validate-build-config.cjs preview" --non-interactive
# Only after explicit build approval:
corepack pnpm exec eas build --platform android --profile preview
```

The first APK build is deliberately interactive for signing decisions. No build
command above was executed in Stage 5. Download/install and physical acceptance
follow a successful cloud build; this stage produces configuration, not an APK.

For the later production review, validate the production environment with
`corepack pnpm exec eas env:exec production "node scripts/validate-build-config.cjs production" --non-interactive`.
The AAB build command, only after its own approval, is
`corepack pnpm exec eas build --platform android --profile production`.

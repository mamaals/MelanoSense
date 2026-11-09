# Stage 5.2: OAuth UI and SDK 57 migration

Date: 2026-10-28. Stage 5.2 implementation and local validation: **complete**.
Overall APK verdict: **NOT READY FOR PREVIEW APK BUILD** pending environment
setup and deployed backend verification. [Stage 5.3](stage53-android-identity.md)
records the subsequent explicit approval and assignment of the Android identity.

## Product behavior

`src/constants/auth.ts` sets `SHOW_SOCIAL_AUTH = false`. Login and Register gate
the complete Google/Apple button groups, including their spacing wrappers.
There was no social divider/copy in the inspected current UI to remove. No
provider buttons or empty social wrappers are rendered with the product flag off.

Email/password handlers, password visibility, validation, loading/errors,
registration confirmation, keyboard-aware scrolling and email-route links remain.
The screen OAuth handlers, AuthContext implementation and callback route remain
available. Re-enabling the flag requires provider/redirect configuration and a
new product decision. This flag does not read or change EAS environment values.

## Version changes

The initial installed versions and lockfile were recorded before installation.
Selected stable target: explicit `expo@57.0.31`, confirmed available in the registry.
Expo's SDK 57 CLI selected native dependency versions; no SDK 58 upgrade occurred.

| Direct package | Before (installed) | After (installed) |
| --- | --- | --- |
| expo | 56.0.21 | 57.0.31 |
| @expo/ui | 56.0.26 | 57.0.26 |
| expo-constants | 56.0.25 | 57.0.22 |
| expo-device | 56.0.4 | 57.0.2 |
| expo-font | 56.0.7 | 57.0.4 |
| expo-glass-effect | 56.0.4 | 57.0.4 |
| expo-image | 56.0.12 | 57.0.5 |
| expo-linking | 56.0.17 | 57.0.13 |
| expo-mail-composer | 56.0.4 | 57.0.2 |
| expo-print | 56.0.4 | 57.0.2 |
| expo-router | 56.2.20 | 57.0.29 |
| expo-sharing | 56.0.26 | 57.0.24 |
| expo-splash-screen | 56.0.15 | 57.0.10 |
| expo-status-bar | 56.0.4 | 57.0.1 |
| expo-symbols | 56.0.7 | 57.0.3 |
| expo-system-ui | 56.0.5 | 57.0.4 |
| expo-web-browser | 56.0.6 | 57.0.3 |
| react-native | 0.85.3 | 0.86.3 |
| react-native-gesture-handler | 2.31.2 | 2.32.0 |
| react-native-reanimated | 4.3.1 | 4.5.1 |
| react-native-worklets | 0.8.3 | 0.10.1 |
| eslint-config-expo | 56.0.4 | 57.0.2 |
| react-test-renderer (dev only) | 19.2.8 | 19.2.3 |

React/React DOM remain `19.2.3`. The existing renderer range had resolved to
`19.2.8`, which requires React `^19.2.8`. Aligning and pinning the dev renderer to
`19.2.3` resolves that peer mismatch without changing the SDK's React version.
An initial new assertion caught the remaining caret range; the package specifier
and lockfile were corrected, then all checks rerun. No assertions were weakened.

Expo itself and the renderer are pinned to exact patches. Other Expo package
ranges come from SDK tooling and their resolved versions are in the frozen
lockfile. `packageManager` remains `pnpm@11.23.0`; lockfile format remains 9.0.
No new direct dependency names were added.

## Hermes and EAS compatibility

Installed React Native's `sdks/.hermesv1version` identifies
`hermes-v250829098.0.17`; its Hermes compiler dependency is also `250829098.0.17`.
The official SDK 57 notes place the memory fix at Expo `57.0.9+` / RN `0.86.2+`
and the separate development-startup fix at Expo `57.0.17+` / RN `0.86.3+`.
Doctor now passes its Hermes check. Physical low-RAM performance remains unverified.

Both EAS profiles inherit the explicit Android image
`ubuntu-26.04-jdk-17-ndk-r27b-sdk-57`. Node `24.15.0`, Corepack, pnpm `11.23.0`
and CLI pin `20.4.0` remain. Node satisfies RN's declared engine range and the
installed EAS CLI's Node requirement. Existing CLI schema/profile resolution
succeeds with the SDK 57 image. Cloud execution has not been attempted.

Expo tooling added `expo-image` and `expo-status-bar` config plugins. Public and
prebuild config resolution pass, including existing Router, font, sharing,
mail-composer and splash plugins. Print types compile and PDF mocks pass.
`react-native-qrcode-svg@6.3.21` remains; its React/RN/SVG peer requirements are
satisfied by the installed tree. Native QR, print, sharing, mail composer and
images still require standalone-device acceptance.

During Stage 5.2, `android.package` was unset and prebuild config supplied the
in-memory fallback `com.placeholder.appid`. Stage 5.3 supersedes that historical
finding: the user-approved `com.ucupysteam.melanosense` is now assigned.

## Validation executed

- `corepack pnpm install --frozen-lockfile`: PASS.
- `corepack pnpm test`: **83 passed, 0 failed, 0 skipped**.
- `corepack pnpm exec tsc --noEmit`: PASS.
- `corepack pnpm lint`: PASS.
- `corepack pnpm exec expo config --type public --json`: PASS, SDK `57.0.0`.
- `corepack pnpm exec expo config --type prebuild --json`: PASS; no native project
  generated and no native build executed.
- `corepack pnpm exec expo install --check`: dependencies up to date.
- `corepack pnpm peers check`: no peer dependency issues.
- `corepack pnpm dlx expo-doctor@1.21.5 --verbose`: **21/21 PASS**; no checks
  excluded/suppressed, no SDK 56 Hermes warning and no dependency mismatch.
- Existing EAS schema/profile resolution: PASS for preview APK and production AAB.
- `git diff --check`: PASS; new untracked files also pass whitespace/conflict checks.
- Stage 5.2 actual preview environment guard: FAIL for missing identity and
  Supabase URL/key. Stage 5.3 resolves identity; missing EAS values still block build.

Tests cover absent provider controls, unchanged email interactions, retained
OAuth handlers under a test-only flag override, email-confirmation navigation,
fixed-Hermes SDK constraints, native alignment and the SDK 57 image. Existing
callback idempotency, session lifecycle, scan observer, QR, History, clinical
formatting, signed image, PDF/email and disconnect tests remain.

Install warnings remain for deprecated existing `react-navigation`, ESLint 9,
transitive `@testing-library/jest-native`, `text-encoding`, and `uuid` versions.
Tests also emit the upstream `react-test-renderer` deprecation warning and
intentional simulated error logs. These were not hidden. Unrelated dependency
cleanup was not folded into this migration.

## Remaining build blockers

- Application ID approval/assignment completed in Stage 5.3:
  `com.ucupysteam.melanosense`. VersionCode remains 1.
- Preview and production EAS environments were re-read and remain empty.
  Configure preview's two client-safe Supabase values only after separate
  approval and confirmation that the operational Pi uses the same project.
- Authorized read-only deployed revision/routes, RLS, Storage, Realtime and
  signup provisioning verification, following the Stage 5.1 checklist.
- Separate build approval, signing review, then standalone physical acceptance.

No backend, Pi, Edge Function, schema, model, EAS environment, signing credential,
deployment or commit changes were made. No cloud build was started.

## Official references

- [SDK 56 reference read before edits](https://docs.expo.dev/versions/v56.0.0/)
- [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [SDK 57 fixes and upgrade notes](https://expo.dev/changelog/sdk-57#known-regressions)
- [Upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Android build images](https://docs.expo.dev/build-reference/infrastructure/)
- [SDK 57 image](https://docs.expo.dev/versions/v57.0.0/sdk/image/)
- [SDK 57 status bar](https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/)

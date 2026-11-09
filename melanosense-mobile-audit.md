# MelanoSense Mobile Completion Audit

Audit dilakukan read-only. Tidak ada file, dependency, migration, deployment, atau commit yang diubah.

Baseline yang diaudit:

- Mobile `main` HEAD `5c1f5ce`.
- Working tree mobile memiliki 9 perubahan tracked, penghapusan `package-lock.json`, serta 4 file untracked.
- Backend `melanosense-core` HEAD `0dbcd5b`; `device-api/index.ts` juga modified tetapi belum committed.
- Current working tree dipakai sebagai source of truth.
- HEAD mobile masih memakai mock history/detail, hardcoded disconnected state, dan no-op disconnect. Working tree sudah mengganti sebagian besar itu dengan implementasi real.
- `process.tsx` masih dummy baik di HEAD maupun working tree.

## A. Architecture Summary

Entry point berasal dari `expo-router/entry` di [package.json](/C:/DATA/Coolyeah/PKM/code/melanosense/package.json:3).

Alur arsitektur saat ini:

1. [Root layout](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/_layout.tsx:17) memuat sembilan font.
2. `AuthProvider` memulihkan session Supabase.
3. `Stack.Protected` memisahkan public dan authenticated routes.
4. Semua authenticated screen memakai custom absolute-positioned [bottom navbar](/C:/DATA/Coolyeah/PKM/code/melanosense/src/components/navbar.tsx:28).
5. Auth state terpusat di [AuthContext](/C:/DATA/Coolyeah/PKM/code/melanosense/src/contexts/AuthContext.tsx:121).
6. Profile/device/scan state tidak terpusat; masing-masing screen melakukan fetch sendiri.
7. [Supabase client](/C:/DATA/Coolyeah/PKM/code/melanosense/src/lib/supabase.ts:14) memakai AsyncStorage, persistent session, auto refresh, dan AppState.
8. Service layer:

   - [profileServices.ts](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/profileServices.ts:4): baca/update profil.
   - [deviceServices.ts](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/deviceServices.ts:7): panggil Edge Function disconnect.
   - [scanServices.ts](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/scanServices.ts:12): history, detail, signed image URL, delete.
9. Realtime hanya digunakan untuk perubahan profile/device di Home. Scan belum menggunakan Realtime.
10. PDF dan email dibuat sepenuhnya di device melalui Expo Print, Sharing, dan MailComposer.

Expo SDK 56 resmi menargetkan React Native 0.85, React 19.2.3, Android 7+, compile/target SDK 36, dan minimum Node 20.19.x. Versi utama project cocok dengan matriks itu. [Expo SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/)

## B. End-to-End User Flow

| Step | Status | Evidence | Notes |
|---|---|---|---|
| App start dan font loading | PARTIAL | [RootLayout](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/_layout.tsx:58) | Font dimuat sebelum AuthProvider; selama itu root mengembalikan `null`, sehingga bisa tampak blank sementara. |
| Session check | COMPLETE | [AuthProvider](/C:/DATA/Coolyeah/PKM/code/melanosense/src/contexts/AuthContext.tsx:125) | `getSession`, `onAuthStateChange`, AsyncStorage, dan UI “Memeriksa sesi” tersedia. Runtime physical-device belum diuji. |
| Login | COMPLETE | [handleEmailLogin](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/login.tsx:31) | Validasi, loading, error, disabled multiple-tap, dan `router.replace` tersedia. |
| Register | PARTIAL | [handleRegister](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/register.tsx:28) | Supabase signup real. Trigger/policy yang membuat row `profiles` tidak ditemukan dalam source dan karenanya UNVERIFIED. |
| OAuth | PARTIAL / UNVERIFIED | [signInWithOAuth](/C:/DATA/Coolyeah/PKM/code/melanosense/src/contexts/AuthContext.tsx:183), [callback](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/auth/callback.tsx:19) | Code/token callback ditangani, scheme ada. Provider, redirect allowlist, cold-start callback, dan release behavior belum terbukti. |
| Masuk ke Home | COMPLETE | [protected stack](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/_layout.tsx:41) | Authenticated routes diproteksi. Expo Router juga membuang protected history saat guard berubah, sehingga logout tidak semestinya bisa di-Back ke screen privat. [Protected routes](https://docs.expo.dev/router/advanced/protected/) |
| Fetch profile | PARTIAL | [Home fetchProfile](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:37) | Query real, tetapi error hanya masuk console dan kemudian UI salah terlihat seperti profile incomplete. |
| Profile validation | PARTIAL | [Home state](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:239), [Edit validation](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/edit-profile.tsx:66) | Home mewajibkan empat field, tetapi edit hanya mewajibkan nama/gender; birth date dan phone ditampilkan seperti opsional. |
| QR ditampilkan | COMPLETE di mobile | [QRCode](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:302) | Payload adalah raw `device_token`, sesuai Pi decoder. Jika token null/error, area QR kosong tanpa error. |
| QR dibaca Pi | COMPLETE di source Pi | [QR decode](/C:/DATA/Coolyeah/PKM/code/melanosense-core/ui/main_window.py:196), [pair worker](/C:/DATA/Coolyeah/PKM/code/melanosense-core/ui/pair_page.py:288) | Pi menerima UUID mentah dan memanggil `/pair`. Deployment dan hardware belum diuji. |
| Pair mengubah database connection state | BROKEN dari source | [handlePair](/C:/DATA/Coolyeah/PKM/code/melanosense-core/supabase/functions/device-api/index.ts:83) | Hanya lookup profile dan touch `devices`; tidak menulis `is_currently_connected=true` atau `device_last_seen_at`. Trigger deployment yang mungkin melakukan ini UNVERIFIED. |
| Mobile menjadi connected | BROKEN | [Home condition](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:246) | Mobile menunggu boolean yang tidak pernah ditulis oleh source pairing. |
| Mulai Scan | BROKEN | [button](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:330), [process](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/process.tsx:17) | Tombol mungkin tidak pernah terbuka; screen process sepenuhnya dummy. |
| Baseline dan menunggu scan baru | MISSING | [process dummy delays](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/process.tsx:19) | Tidak ada user lookup, baseline, Realtime INSERT, polling, status check, atau deduplication. |
| Scan dimasukkan ke database | COMPLETE di source Pi/backend; deployment UNVERIFIED | [Pi publish](/C:/DATA/Coolyeah/PKM/code/melanosense-core/ui/camera_page.py:411), [ingest](/C:/DATA/Coolyeah/PKM/code/melanosense-core/supabase/functions/device-api/index.ts:149) | User ditentukan backend dari token; scan default `completed`; foto masuk private bucket. |
| Process menuju detail scan baru | BROKEN | [router destination](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/process.tsx:35) | Selalu pindah ke `/history`, bukan `/history/[id]`. Dapat tetap bernavigasi sesudah user menekan Back karena delay tidak dibatalkan. |
| History | PARTIAL | [history query](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/scanServices.ts:44), [screen](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/history.tsx:55) | Real, per-user, paginated, newest-first; tetapi tidak ada pull-to-refresh dan kolom “Hasil” menampilkan raw `status`, biasanya `completed`, bukan diagnosis. |
| Detail | PARTIAL | [getScanById](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/scanServices.ts:92), [detail fetch](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/history/[id].tsx:256) | Query dibatasi ID dan current user, signed image URL tersedia. Confidence salah skala. |
| PDF/email | PARTIAL | [PDF/email handlers](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/history/[id].tsx:336) | PDF dan attachment real, tetapi confidence salah dan beberapa raw DB values belum human-readable. Foto tidak ikut PDF. |
| Disconnect | PARTIAL / deployment UNVERIFIED | [mobile invoke](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/deviceServices.ts:7), [backend WT](/C:/DATA/Coolyeah/PKM/code/melanosense-core/supabase/functions/device-api/index.ts:100) | Mobile support ada. Backend support hanya ada di uncommitted working tree core; deployment tidak dapat dibuktikan. |
| Token rotation dan QR baru | PARTIAL | [disconnect payload](/C:/DATA/Coolyeah/PKM/code/melanosense-core/supabase/functions/device-api/index.ts:112) | Source merotasi token, false, dan null lalu mobile refetch. Pi tetap memegang token lama sampai restart/switch account; backend akan menolaknya. |
| Logout dan login ulang | COMPLETE secara source | [signOut](/C:/DATA/Coolyeah/PKM/code/melanosense/src/contexts/AuthContext.tsx:215), [profile logout](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/profile.tsx:78) | Route guard serta replace mencegah Back ke authenticated screen. Physical test masih diperlukan. |

## C. Feature Matrix

| Feature | Status | Evidence |
|---|---|---|
| Email/password login | COMPLETE | [login.tsx](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/login.tsx:31) |
| Signup | PARTIAL | [register.tsx](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/register.tsx:28); profile provisioning UNVERIFIED |
| Session persistence | COMPLETE secara source | [supabase.ts](/C:/DATA/Coolyeah/PKM/code/melanosense/src/lib/supabase.ts:18), [AuthContext](/C:/DATA/Coolyeah/PKM/code/melanosense/src/contexts/AuthContext.tsx:125) |
| Expired-token refresh | PARTIAL | Auto refresh/AppState ada; error/re-auth UX tidak ada |
| Authenticated/unauthenticated guards | COMPLETE | [layout](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/_layout.tsx:33) |
| OAuth providers | UNVERIFIED | Source client ada; external provider/redirect config tidak tersedia |
| OAuth callback | PARTIAL | Error timer kedua tidak dibersihkan; cold-start token-fragment path belum terbukti |
| Profile fetch | PARTIAL | Real query, tetapi error UX lemah |
| Profile edit | PARTIAL | Real update, validation tidak konsisten dengan Home |
| Profile/device live state | BROKEN | Pair endpoint tidak menulis connection state |
| Home pull-to-refresh | COMPLETE | [RefreshControl](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:260) |
| Home focus refresh | COMPLETE | [useFocusEffect](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:149) |
| Home Realtime cleanup | COMPLETE | [removeChannel](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:223) |
| Home polling | PARTIAL | Cleanup ada, tetapi setiap 3 detik dan request dapat overlap |
| QR token rendering | COMPLETE | [home.tsx](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/home.tsx:312) |
| Pi QR pairing | COMPLETE secara source | [pair_page.py](/C:/DATA/Coolyeah/PKM/code/melanosense-core/ui/pair_page.py:240) |
| Authenticated disconnect | PARTIAL | Mobile + backend WT ada; deploy UNVERIFIED |
| Pi reacts to mobile disconnect | MISSING | Tidak ada remote revoke notification atau automatic local unpair |
| Real process/scan wait | BROKEN | Dummy timer |
| Realtime scan INSERT | MISSING | Tidak ada subscription `scans` |
| Scan polling fallback | MISSING | Tidak ada |
| Exactly-once result navigation | MISSING | Tidak ada dedupe/guard |
| History current-user filtering | COMPLETE | `.eq('user_id', user.id)` |
| History database pagination | COMPLETE | Exact count + `.range()` |
| History sorting | COMPLETE | Newest first |
| History loading/empty/error | COMPLETE | Semua state tersedia |
| History refresh gesture | MISSING | Tidak ada RefreshControl |
| History clinically useful result label | BROKEN | Menampilkan `status`, bukan `diagnosis` |
| Detail own-user protection | COMPLETE di client | ID + user filter; tetap bergantung RLS |
| Storage `scan-images` signed URL | COMPLETE secara source | [getScanImageUrl](/C:/DATA/Coolyeah/PKM/code/melanosense/src/services/scanServices.ts:12) |
| One scan image, no per-ABCD images | COMPLETE | [detail image](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/history/[id].tsx:507), [AnalysisCard](/C:/DATA/Coolyeah/PKM/code/melanosense/src/components/AnalysisCard.tsx:9) |
| Diagnosis color/icon states | COMPLETE | Green safe, red danger, neutral help icon |
| Confidence | BROKEN | Backend 0–1, mobile menambahkan `%` langsung |
| Null handling | PARTIAL | Banyak field menjadi `-`; NaN/out-of-range confidence tidak ditangani |
| PDF generation | PARTIAL | Real, escaped HTML, disclaimer ada; raw values/confidence salah |
| Scan photo in PDF | MISSING / OPTIONAL | Tidak dimasukkan |
| Email attachment | COMPLETE secara source | Current user email + PDF attachment |
| Offline UX | MISSING | Hanya error text/alert per request; tidak ada explicit offline state |
| Android build profiles | MISSING | `eas.json` tidak ada |
| Android application ID | MISSING | `android.package` tidak ada |
| Android versionCode | MISSING | Tidak ada |
| Automated tests | MISSING | Tidak ada test/e2e file atau script |

Live schema read-only pada project Supabase yang dikonfigurasi mengonfirmasi semua kolom yang dipakai mobile—termasuk `recommendation`, connection fields, dan `devices`—tersedia. Hal ini hanya memverifikasi schema deployment, bukan Edge Function version, Realtime publication, atau authenticated cross-user RLS.

## D. P0 Blockers

1. **Pairing tidak bisa membuka connected UI dari source.** `handlePair` tidak mengubah profile connection fields. Akibatnya flow berhenti sebelum “Mulai Scan”.

2. **`process.tsx` masih sepenuhnya fake.** Delay 2.5 + 4 + 3 detik, tidak menunggu row scan, tidak memfilter user, tidak deduplicate, dan menuju history list. Delay tetap berjalan setelah Back sehingga bisa melakukan navigation leak.

3. **Confidence salah hingga faktor 100.** Pi menampilkan dan mengirim `prob` 0–1 di [camera_page.py](/C:/DATA/Coolyeah/PKM/code/melanosense-core/ui/camera_page.py:308), sedangkan mobile menghasilkan `${confidence}%` di [detail](/C:/DATA/Coolyeah/PKM/code/melanosense/src/app/history/[id].tsx:647) dan PDF. Contoh `0.917` tampil `0.917%`, seharusnya `91.7%`. Untuk aplikasi medis/screening, ini adalah misrepresentasi material.

## E. P1 Core Remaining Work

- Lengkapi kontrak pairing: pair harus memperbarui connection state dan last seen; ingest idealnya menyegarkan last seen.
- Pastikan source backend, deployed Edge Function, dan mobile memakai kontrak yang sama. Disconnect backend saat ini hanya perubahan lokal di core.
- Ganti process dengan baseline + Realtime INSERT + polling fallback + exactly-once navigation.
- History harus mengambil dan menampilkan diagnosis manusiawi, bukan `completed`.
- PDF harus memakai formatter diagnosis/status/confidence yang sama dengan UI.
- Selaraskan required profile fields dan validation; network/profile error tidak boleh dianggap sebagai incomplete profile.
- Verifikasi registration benar-benar membuat row profile.
- Verifikasi RLS authenticated cross-user, Storage policy deployment, dan Realtime publication untuk `profiles`/`scans`.
- OAuth Google/Apple harus diuji di release scheme atau tombol yang belum didukung jangan ditampilkan.
- Selesaikan lint errors.
- Tambahkan Android application ID, versionCode, dan EAS APK/AAB profiles.
- Tetapkan satu package manager/lockfile secara deterministik.

## F. P2 UX / Robustness

- Home polling 3 detik menghasilkan 20 request/menit per user dan terus aktif selama Home focused; request lama dapat menimpa Realtime state baru.
- `device_last_seen_at` tidak dipakai, sehingga UI tidak dapat membedakan paired, online, stale, atau offline.
- Home fetch error hanya dicatat ke console lalu UI menampilkan kondisi yang salah.
- Profile screen tidak punya visible error/retry state.
- History tidak memiliki pull-to-refresh.
- Detail image failure hanya masuk console dan foto hilang tanpa status.
- Login/register tidak memakai ScrollView atau KeyboardAvoidingView; keyboard dapat menutupi tombol pada layar kecil.
- Bottom navbar tidak memakai safe-area bottom inset.
- `router.push` pada navbar dapat menumpuk instance route dan subscription.
- Date validator menerima tanggal kalender tidak valid seperti tanggal yang dinormalisasi JavaScript.
- Callback memiliki timer error yang tidak dibersihkan.
- “Ingat Saya” dan “Lupa Password?” merupakan affordance tanpa aksi.
- Guide menjelaskan arah scanning QR secara keliru.
- Session Supabase disimpan di AsyncStorage. Ini standar operasional tetapi bukan encrypted secure storage; perlu keputusan threat model sebelum public release.
- Expo Doctor menemukan regresi memori Hermes V1 pada Expo 56.0.21/RN 0.85.3. Untuk target low-spec, ini harus menjadi release gate, walaupun tidak menghalangi build APK awal.

## G. P3 Polish

- Route `/explore` masih berisi starter Expo dan dapat dibuka melalui deep link.
- Banyak starter components/assets tidak dipakai.
- `deleteCurrentUserScan`, `Device` type, `LogoutConfirmModal`, dan `asyncstorage.ts` tidak digunakan.
- Tiga unused-import warning.
- Debug `console.log/warn` masih ada.
- Label “Tempat Tanggal Lahir” hanya menampilkan tanggal.
- UI mencampur bahasa Indonesia dan Inggris.
- Sembilan font dimuat saat start, termasuk `Manrope-Light` yang tidak dipakai.
- Raw ABCD/stage dari Pi masih berupa teks teknis bahasa Inggris.
- Nama aplikasi launcher masih lowercase `melanosense`.

## H. P4 Optional

- Masukkan foto scan ke PDF.
- Per-device revocation/device management.
- Password reset penuh.
- Delete history UI.
- Web/iOS productization.
- Automatic Pi reaction saat token dicabut, bukan meminta user memilih Switch Account.
- Share/email success analytics.

## I. Mock / Placeholder Code Remaining

| Item | Classification |
|---|---|
| Dummy delays di `process.tsx` | **Functional blocker / P0** |
| Starter `/explore` dan related components | Release polish / P3 |
| “Ingat Saya” tanpa state/action | User-visible placeholder / P2 |
| “Lupa Password?” tanpa action | User-visible placeholder / P2 |
| Placeholder Supabase URL/key fallback | Harmless development fallback, tetapi profile errors harus tetap terlihat |
| `qr random.png`, React starter assets | Harmless dead assets / P3 |
| Debug console logs | Development-only / P3 |
| `setTimeout` di auth callback | Legitimate redirect delay; cleanup masih perlu |
| `setTimeout` di process delays | Fake functional implementation / P0 |

## J. Security Review

- Tidak ditemukan service-role key, Supabase PAT, `DEVICE_INGEST_SECRET`, private key, atau hardcoded secret di mobile source maupun history metadata yang diperiksa.
- `.env` tracked oleh git, tetapi hanya berisi dua `EXPO_PUBLIC_*` client-safe entries: Supabase URL dan publishable key. Nilai tidak dicetak selama audit.
- Karena `EXPO_PUBLIC_*` akan tertanam di APK, file tersebut tidak boleh pernah diisi credential rahasia.
- Core menyimpan service role dan device secret sebagai server/device environment names, bukan di mobile.
- Backend ingest tidak mempercayai `user_id` dari Pi; user ditentukan dari token server-side.
- Detail dan delete query menambahkan current-user filter.
- Disconnect working-tree backend memvalidasi JWT melalui Supabase Auth sebelum melakukan update.
- Policy source untuk private `scan-images` tersedia di [migration core](/C:/DATA/Coolyeah/PKM/code/melanosense-core/supabase/migrations/20260709060700_device_registry.sql:56).
- Policy `profiles` dan `scans` tidak tersedia dalam source yang diaudit. Anonymous live reads mengembalikan nol row, tetapi ini belum membuktikan authenticated user tidak dapat membaca user lain. **RLS cross-user: UNVERIFIED.**
- Token lama tidak akan digunakan mobile setelah successful rotation/refetch. Pi masih menyimpannya dalam memory, tetapi backend lookup akan menolak token tersebut.
- `getScanImageUrl` menerima full HTTP(S) URL sebagai bypass signed-storage flow. Current backend hanya menulis storage path, sehingga risikonya rendah tetapi kontraknya lebih longgar dari yang diperlukan.

## K. Performance / Low-Spec Review

Hal yang sudah baik:

- History memakai FlatList dan hanya mengambil tiga row per page.
- Detail hanya merender satu gambar, bukan satu gambar per ABCD.
- Tidak ada blur/glass animation berat pada flow utama.
- Realtime channel Home dan polling interval memiliki cleanup dasar.
- PDF dibuat on-demand.

Masalah nyata/potensial:

- [Logo.png](/C:/DATA/Coolyeah/PKM/code/melanosense/assets/images/Logo.png) berukuran 4320×4320 tetapi dirender 275×275. Ukuran file hanya 137 KB, tetapi decoded RGBA bitmap dapat mendekati 71 MiB.
- Sembilan font dimuat sebelum app muncul.
- Polling profile setiap 3 detik terlalu agresif untuk state pairing yang jarang berubah.
- Navbar absolute 82 px tidak mengikuti gesture/navigation inset.
- Fixed 275 px logo, 220 px QR, dan non-scroll auth forms berpotensi bermasalah pada small screen.
- Detail memakai dua fixed 96 px circles dalam horizontal row; long localization/text dapat menekan kolom kanan.
- Full-resolution scan image source tidak memiliki explicit loading/error placeholder.
- Known Hermes memory regression dari Expo Doctor relevan langsung untuk target low-mid Android.

## L. Android / Expo Build Readiness

Yang siap:

- Expo config berhasil di-resolve dan schema-valid.
- Expo `56.0.21`, React `19.2.3`, RN `0.85.3`, serta package Expo utama selaras.
- Owner dan EAS project ID sudah ada.
- Scheme `melanosense` sudah ada.
- Icon, adaptive icon, dan Android splash assets ada.
- Splash memakai SDK 56 config-plugin format yang valid.
- Tidak ada permission sensitif yang diperlukan oleh flow mobile saat ini.
- Node lokal 24.15.0 berada di atas minimum SDK 56.

Yang belum siap:

- `eas.json` tidak ada.
- `android.package` tidak ada.
- `android.versionCode` tidak ada.
- Tidak ada APK/AAB artifact.
- Tidak ada release environment strategy yang terdokumentasi.
- OAuth redirect allowlist release belum terverifikasi.
- Lockfile sedang dalam transisi: npm lock dihapus, pnpm lock/workspace masih untracked, dan `packageManager` tidak dideklarasikan.
- Lint belum lulus.
- Expo Doctor belum lulus karena Hermes memory regression.

EAS menghasilkan AAB secara default; APK installable memerlukan profile seperti `distribution: internal` atau `android.buildType: apk`. [Expo APK guide](https://docs.expo.dev/build-reference/apk/)

`android.package` dan `android.versionCode` adalah build identity/version fields yang belum ada di resolved config. [SDK 56 app config](https://docs.expo.dev/versions/v56.0.0/config/app/)

Kesimpulan:

- **APK testing:** belum siap secara repository; masih membutuhkan build configuration dan P0 flow fixes.
- **AAB production:** belum siap.
- Project mungkin dapat dipandu secara interaktif oleh EAS untuk mengisi beberapa field, tetapi itu tidak sama dengan reproducible release configuration.

## M. Typecheck / Lint / Expo Doctor Results

| Check | Result | Detail |
|---|---|---|
| `npx tsc --noEmit` | PASS | Tidak ada TypeScript error |
| `npm run lint` | FAIL | 2 errors, 3 warnings |
| `npx expo-doctor --verbose` | FAIL 21/22 | Known Hermes V1 memory regression |
| `git diff --check` | PASS | Hanya LF→CRLF warnings |
| `npx expo config --type public` | PASS | Config valid; mengonfirmasi package/versionCode tetap tidak ada |
| Tests | NOT AVAILABLE | Tidak ada test files atau test script |

Semua lint findings sudah ada di HEAD, bukan diperkenalkan oleh working-tree feature changes:

- Error: synchronous `setMessage` di auth callback effect.
- Error: `fetchProfile` digunakan sebelum deklarasi di edit-profile.
- Warning: unused `Touchable` di login/register.
- Warning: unused `useEffect` di profile.

Expo Doctor:

- Hermes V1 `250829098.0.10` terdeteksi terdampak memory regression.
- Doctor menyatakan fix pertama berada pada Hermes `250829098.0.16`, dan menyarankan Expo SDK 57/RN 0.86.2+.
- Tidak ada upgrade dilakukan.

## N. Definition of Done

- [x] Expo Router entry dan authenticated route protection tersedia.
- [x] Email/password login menggunakan Supabase real.
- [x] Session dikonfigurasi persisten dan dipulihkan saat startup.
- [ ] Persistence dibuktikan pada release APK setelah force-close/reopen.
- [ ] Registration-to-profile provisioning dibuktikan dan terdokumentasi dalam source.
- [ ] OAuth release callback/provider configuration teruji atau tombol unsupported dihapus.
- [x] Profile real data dapat dibaca dan diperbarui.
- [ ] Required profile validation konsisten dan calendar/phone validation benar.
- [ ] Profile/Home memiliki explicit loading/error/retry behavior.
- [x] Mobile menghasilkan QR dari raw `device_token`.
- [x] Pi source dapat membaca QR dan memanggil backend pairing.
- [ ] Pairing mengubah connected state dan last-seen secara real.
- [ ] Disconnect source deployed dan diuji.
- [ ] Token lama ditolak dan mobile menunjukkan QR baru.
- [ ] Process mengambil baseline scan current user.
- [ ] Process menunggu scan baru melalui Realtime dengan polling fallback.
- [ ] Existing scan dan scan user lain tidak menyelesaikan process.
- [ ] Realtime/poll duplicate hanya bernavigasi sekali.
- [ ] Back/unmount membersihkan semua subscription/interval.
- [ ] Process menuju `/history/[id]` untuk row baru.
- [x] History query current user, paginated, newest-first.
- [ ] History menampilkan diagnosis yang bermakna dan bisa pull-to-refresh.
- [x] Detail dibatasi scan ID + current user.
- [x] Private storage path diubah menjadi signed URL.
- [x] Detail menampilkan satu scan image dan ABCD tanpa image per-card.
- [x] Diagnosis safe/danger/neutral visual tersedia.
- [ ] Confidence 0–1 dikonversi dan divalidasi dengan benar.
- [ ] PDF memakai human-readable fields dan confidence yang benar.
- [x] PDF memiliki disclaimer.
- [x] Email memakai alamat akun dan PDF attachment.
- [ ] Semua core async screen memiliki loading/success/empty/error/retry yang masuk akal.
- [ ] RLS authenticated cross-user dan Realtime publication terverifikasi.
- [ ] Small-screen, keyboard, safe-area, dan low-spec issues diselesaikan.
- [ ] Typecheck dan lint lulus.
- [ ] Hermes memory regression diselesaikan atau risiko secara eksplisit diterima.
- [ ] Satu package manager/lockfile final ditetapkan.
- [ ] Android package ID dan versionCode tersedia.
- [ ] EAS preview APK dan production AAB profiles tersedia.
- [ ] APK terpasang dan lulus physical-device acceptance test.
- [ ] Production AAB berhasil dibuat setelah acceptance APK.

## O. Recommended Stage Roadmap

### Stage 1 — Restore the real device-to-result pipeline

Goal: membuat pairing mengubah state mobile dan mengganti process dummy dengan scan-driven completion.

Why: dua blocker ini menghentikan happy path utama.

Files likely involved:

- `src/app/home.tsx`
- `src/app/process.tsx`
- `src/services/scanServices.ts`
- `src/types/scans.ts`
- `melanosense-core/supabase/functions/device-api/index.ts`

Acceptance criteria:

- Pair menulis connected true dan last-seen.
- Existing/user-lain scan diabaikan.
- Realtime + polling fallback bekerja.
- Hanya satu navigation ke scan detail.
- Back membersihkan semua listener/timer.
- Tidak ada fake completion timer.

Dependency: none; live schema fields sudah divalidasi, tetapi deploy tetap terpisah.

### Stage 2 — Correct history, result, PDF, and confidence data

Goal: memastikan semua clinical/result data ditampilkan benar dan konsisten.

Why: confidence sekarang salah faktor 100 dan history tidak menampilkan diagnosis.

Files likely involved:

- `src/services/scanServices.ts`
- `src/types/scans.ts`
- `src/app/history.tsx`
- `src/app/history/[id].tsx`
- `src/components/AnalysisCard.tsx`

Acceptance criteria:

- `0.917 → 91.7%`.
- Null/malformed/out-of-range tidak menghasilkan misleading number.
- History menampilkan diagnosis manusiawi.
- UI dan PDF memakai formatter yang sama.
- Pagination/current-user restriction tetap.
- PDF disclaimer tetap; foto tetap optional.

Dependency: Stage 1.

### Stage 3 — Harden auth, profile, and network state

Goal: menutup error/race/lifecycle gaps tanpa mengubah arsitektur besar.

Why: core happy path masih mudah berubah menjadi misleading state ketika network/profile gagal.

Files likely involved:

- `src/contexts/AuthContext.tsx`
- `src/app/auth/callback.tsx`
- `src/app/login.tsx`
- `src/app/register.tsx`
- `src/app/home.tsx`
- `src/app/profile.tsx`
- `src/app/edit-profile.tsx`
- `src/services/profileServices.ts`
- `src/lib/supabase.ts`

Acceptance criteria:

- Lint errors auth/profile hilang.
- Profile fetch error terlihat dan retryable.
- Validation konsisten.
- Tidak ada overlapping polling/stale overwrite.
- Auth callback timers aman.
- Signup/profile provisioning dan OAuth diberi verified status nyata.

Dependency: Stage 1–2.

### Stage 4 — Small-screen and low-spec hardening

Goal: menyiapkan UI untuk Android entry-level dan membersihkan false affordances/starter code.

Why: form keyboard, absolute navbar, dan oversized logo berisiko langsung pada target device.

Files likely involved:

- `_layout.tsx`, `index.tsx`, login/register
- `navbar.tsx`
- Home/profile/history/detail/guide
- `assets/images/Logo.png`
- `explore.tsx` dan starter-only components

Acceptance criteria:

- Auth forms usable dengan keyboard pada small screen.
- Navbar menghormati safe-area dan tidak menumpuk route.
- Main content tidak tertutup navbar.
- Logo decode footprint masuk akal.
- Guide pairing benar.
- Tidak ada inert controls atau exposed Expo starter screen.

Dependency: Stage 3.

### Stage 5 — Reproducible Android release configuration

Goal: membuat konfigurasi deterministic untuk preview APK dan production AAB.

Why: project belum memiliki package ID, versionCode, `eas.json`, atau final lockfile policy.

Files likely involved:

- `app.json`
- new `eas.json`
- `package.json`
- salah satu lockfile final
- `.gitignore`/`.easignore` bila diperlukan

Acceptance criteria:

- Resolved config memiliki package ID/versionCode.
- Preview menghasilkan APK; production profile menghasilkan AAB.
- Environment dan OAuth callback release terdokumentasi.
- Typecheck/lint lulus.
- Hermes regression mempunyai explicit resolution/approval; tidak ada silent major upgrade.

Dependency: Stage 4.

### Stage 6 — Physical APK acceptance and release candidate

Goal: membuktikan seluruh flow dengan real APK, Pi, Supabase, image, PDF/email, disconnect, dan relogin.

Why: Realtime, OAuth, mail clients, QR camera, storage policy, dan EAS signing tidak dapat dinyatakan complete dari static source saja.

Acceptance criteria:

- Acceptance matrix lulus pada minimal satu low/mid Android.
- Realtime-off test membuktikan polling fallback.
- Old token ditolak setelah disconnect.
- APK metadata tercatat.
- AAB hanya dibuat setelah APK diterima.

Dependency: semua stage sebelumnya.

## P. Ready-to-Paste Prompt — Stage 1

```text
Selesaikan Stage 1 MelanoSense: real device-to-result pipeline.

Workspace:
- melanosense: React Native + Expo mobile
- sibling melanosense-core: Raspberry Pi + Supabase Edge Function

Sebelum menulis code:
1. Baca AGENTS.md.
2. Baca dokumentasi exact Expo SDK 56 di https://docs.expo.dev/versions/v56.0.0/.
3. Audit ulang git status/diff kedua repository. Pertahankan seluruh perubahan user.
4. Jangan install/update dependency, jangan membuat migration, jangan deploy, jangan commit.

Current behavior yang sudah ditemukan:
- Home menampilkan raw profiles.device_token sebagai QR.
- Home menganggap connected hanya jika is_currently_connected === true.
- Home punya profile Realtime dan polling 3 detik.
- melanosense-core/supabase/functions/device-api/index.ts handlePair saat ini hanya lookup profile dan touch devices; tidak menulis is_currently_connected/device_last_seen_at.
- Live schema sebelumnya sudah mengonfirmasi kedua kolom tersedia, tetapi verifikasi ulang secara read-only bila perlu.
- src/app/process.tsx masih dummy delay 2500/4000/3000 ms dan selalu router.replace('/history').
- Pi/backend memasukkan row scans untuk user hasil resolusi device_token, default status completed.

Scope perubahan:
- melanosense/src/app/home.tsx
- melanosense/src/app/process.tsx
- melanosense/src/services/scanServices.ts
- melanosense/src/types/scans.ts
- jika diperlukan file helper kecil yang benar-benar scoped
- melanosense-core/supabase/functions/device-api/index.ts
Jangan refactor screen/navigation lain.

Target backend:
- Setelah device_token valid dan pair berhasil, update profile pemilik dengan:
  is_currently_connected=true
  device_last_seen_at=current server timestamp
- Segarkan last-seen pada successful ingest bila sesuai kontrak yang sudah ada.
- Pertahankan authentication boundary: pair/ingest memakai X-Device-Secret; disconnect memakai authenticated user JWT.
- Pertahankan token rotation disconnect yang ada.
- Jangan mengarang table, column, RPC, route, atau migration baru.
- Jangan deploy otomatis.

Target process:
- Ambil authenticated current user.
- Buat baseline scan current user sebelum menunggu hasil baru.
- Subscribe Supabase Realtime untuk INSERT scans milik user tersebut.
- Sediakan polling fallback yang scoped hanya selama process focused/mounted.
- Atasi race baseline-versus-subscription dengan desain yang dapat dijelaskan; jangan sekadar baseline lalu subscribe tanpa mitigasi.
- Existing scan tidak boleh langsung dianggap hasil baru.
- Scan user lain tidak boleh menyelesaikan flow.
- Realtime dan polling yang menemukan row sama hanya boleh navigate sekali.
- Navigate langsung dengan router.replace ke /history/[id] dan ID row baru.
- Current Pi inserts completed; tangani status secara eksplisit tanpa mengarang status contract.
- CHANNEL_ERROR/TIMED_OUT harus membuat polling tetap bekerja dan memberi UX yang masuk akal.
- User Back/unmount harus membersihkan channel, interval, async callbacks, dan mencegah navigation terlambat.
- Hapus seluruh fake completion delays/progress.
- Beri loading/wait/error/retry/cancel behavior yang masuk akal.
- Cegah multiple tap/start.

Acceptance checks:
- Seeded existing scan tidak menyelesaikan process.
- INSERT current user menyelesaikan process sekali.
- INSERT user lain diabaikan.
- Simultaneous Realtime + polling hanya navigate sekali.
- Back sebelum hasil tidak menavigasi belakangan.
- Realtime failure masih bisa selesai lewat polling.
- Pair mengubah mobile dari QR state ke connected state.
- Tidak ada polling/subscription leak.

Verification:
- npx tsc --noEmit
- npm run lint
- npx expo-doctor --verbose
- git diff --check
- Tampilkan diff summary dan hasil test.
Jangan auto commit.
```

## Q. Ready-to-Paste Prompt — Stage 2

```text
Selesaikan Stage 2 MelanoSense: correctness history, detail, confidence, PDF, dan email.

Sebelum code:
- Baca AGENTS.md dan exact Expo SDK 56 docs.
- Audit git status/diff dan pertahankan perubahan user.
- Jangan install dependency, migration, deploy, atau commit.
- Jangan refactor di luar scope.

Current behavior:
- getCurrentUserScanHistory paginated, newest-first, current-user-only, tetapi hanya memilih id/created_at/status.
- History memberi label “Hasil” tetapi menampilkan raw status seperti completed.
- getScanById membatasi id + current user dan mengambil image/ABCD/status/diagnosis/stage/confidence/recommendation.
- scan-images path dibuat signed URL.
- Pi mengirim melanoma_probability dalam skala 0.0–1.0.
- Detail dan PDF saat ini langsung menambahkan %, sehingga 0.917 tampil 0.917%.
- UI diagnosis safe/danger/neutral sudah ada.
- PDF berisi ABCD, diagnosis, status, stage, confidence, recommendation, disclaimer; foto belum ikut PDF.
- Email mengirim PDF ke email current user.

Scope:
- src/services/scanServices.ts
- src/types/scans.ts
- src/app/history.tsx
- src/app/history/[id].tsx
- src/components/AnalysisCard.tsx jika benar-benar diperlukan

Target:
1. History query tetap server-paginated/current-user/newest-first, tetapi ambil diagnosis yang diperlukan.
2. History tampilkan diagnosis human-readable; status boleh ditampilkan terpisah bila berguna.
3. Tambahkan pull-to-refresh tanpa merusak pagination/request-race protection.
4. Buat satu confidence normalization/formatting path untuk UI dan PDF.
5. Contract utama adalah DB 0..1:
   - 0.917 => 91.7%
   - 0 => 0%
   - 1 => 100%
   - null/undefined/NaN/infinite/outside contract => unavailable, bukan misleading percent.
6. Pertahankan safe/danger/neutral diagnosis behavior.
7. Format diagnosis/status ke label manusiawi di UI dan PDF; jangan cetak raw snake_case jika mapping diketahui.
8. Null recommendation/stage/ABCD harus punya fallback yang jelas.
9. Pertahankan satu image utama; jangan menambah image per ABCD.
10. Foto di PDF optional dan di luar scope stage ini.
11. Pertahankan escapeHtml dan jangan membuat HTML injection.
12. Tambahkan retry detail yang benar untuk fetch failure dan explicit image loading/failure state bila ringan.
13. Jangan mengubah schema/API/backend contract.

Acceptance tests:
- Confidence 0.917 tampil 91.7% di UI dan PDF.
- Malformed confidence tidak tampil sebagai NaN%/Infinity%.
- non_melanoma hijau/check.
- melanoma/risk merah/warning.
- pending/unknown neutral.
- History user lain tidak pernah di-query atau ditampilkan.
- Pagination tidak mengambil seluruh table.
- Refresh tidak menimbulkan stale response.
- PDF tetap punya disclaimer dan attachment email tetap berfungsi.

Run:
- npx tsc --noEmit
- npm run lint
- npx expo-doctor --verbose
- git diff --check

Laporkan perubahan, hasil checks, dan external behavior yang masih UNVERIFIED.
Jangan auto commit.
```

## R. Ready-to-Paste Prompt — Stage 3

```text
Selesaikan Stage 3 MelanoSense: auth, profile, dan network-state hardening.

Sebelum code:
- Baca AGENTS.md dan exact Expo SDK 56 docs.
- Inspect current working tree; jangan menimpa perubahan Stage 1/2 atau user.
- Jangan install dependency, membuat migration, deploy, atau commit.
- Jangan melakukan navigation/state-management refactor besar.

Current behavior:
- Supabase session memakai AsyncStorage, persistSession, autoRefreshToken, AppState, getSession, dan onAuthStateChange.
- Stack.Protected menjaga public/authenticated routes.
- Login/register punya loading/error dan disabled button.
- OAuth source ada tetapi provider/redirect deployment belum terbukti.
- Auth callback punya lint error setState-in-effect dan satu delayed redirect tanpa cleanup.
- Signup-to-profiles provisioning tidak terdapat di source yang diaudit.
- Home menganggap profile error sebagai profile incomplete.
- Profile screen gagal fetch lalu menampilkan fallback fields tanpa visible error/retry.
- Home required fields: full_name, phone, birth_date, gender.
- Edit profile hanya mewajibkan full_name/gender dan date validation masih menerima tanggal kalender invalid.
- Home polling dapat overlap dan menimpa state baru.
- Lint saat audit: 2 errors dan 3 warnings, semuanya pre-existing.

Scope:
- src/contexts/AuthContext.tsx
- src/lib/supabase.ts
- src/app/auth/callback.tsx
- src/app/login.tsx
- src/app/register.tsx
- src/app/home.tsx
- src/app/profile.tsx
- src/app/edit-profile.tsx
- src/services/profileServices.ts

Target:
1. Pertahankan persistent session dan route guards.
2. Tangani initialization/getSession failure dengan deterministic UI; jangan infinite spinner/blank.
3. Bersihkan callback timers dan hindari state update/navigation setelah unmount.
4. Hilangkan auth/profile lint errors dan unused-import warnings.
5. Jangan mengklaim OAuth complete tanpa memverifikasi provider + redirect config. Jika external config tidak dapat diperiksa, laporkan UNVERIFIED. Jangan mengarang config.
6. Verifikasi signup menghasilkan profile dengan backend test/source yang sah. Jika contract tidak tersedia, jangan blind upsert dan jangan membuat migration; stop dan laporkan dependency backend.
7. Bedakan Home:
   - PROFILE_LOADING
   - PROFILE_ERROR dengan retry
   - PROFILE_INCOMPLETE
   - DEVICE_NOT_CONNECTED
   - DEVICE_CONNECTED
8. Selaraskan field wajib edit-profile dengan Home dan tampilkan required indicators.
9. Validasi birth_date sebagai tanggal kalender nyata; phone minimal masuk akal tanpa overvalidation.
10. Cegah save/fetch double request dan stale response.
11. Batasi polling profile pada kondisi yang memerlukannya, cegah overlap, dan pertahankan Realtime fallback.
12. Cleanup polling/subscription harus aman pada blur, unmount, background, dan Fast Refresh.
13. Jangan menambahkan network-state dependency baru.
14. “Ingat Saya” dan “Lupa Password?” tidak boleh tetap menjadi tombol palsu: implementasikan hanya memakai contract yang sudah ada atau hilangkan/nonaktifkan dengan copy yang jujur.

Acceptance:
- Login → force close → reopen tetap authenticated secara source dan siap physical test.
- Logout menghapus protected history; Back tidak membuka private screen.
- Network/profile error tidak tampil sebagai incomplete profile.
- Required fields konsisten.
- No overlapping profile polling.
- Callback tidak menavigasi setelah unmount.
- Typecheck/lint lulus.

Run:
- npx tsc --noEmit
- npm run lint
- npx expo-doctor --verbose
- git diff --check

Jangan auto commit dan jangan refactor di luar scope.
```

## S. Ready-to-Paste Prompt — Stage 4

```text
Selesaikan Stage 4 MelanoSense: small-screen, low-spec, safe-area, dan release polish.

Sebelum code:
- Baca AGENTS.md dan exact Expo SDK 56 docs.
- Audit git diff dan jaga perubahan Stage 1–3.
- Jangan install/update dependency, migration, deploy, atau commit.
- Hindari redesign/refactor besar; pertahankan visual identity.

Temuan saat ini:
- Login/register bukan ScrollView/KeyboardAvoidingView.
- Bottom navbar absolute height 82, bottom 0, tanpa safe-area inset.
- Navbar memakai router.push sehingga dapat menumpuk route instance.
- Screen content memakai hardcoded bottom padding.
- Logo.png 4320x4320 dirender 275x275 dan berpotensi decode sekitar 71 MiB.
- Sembilan font dimuat pada startup; Manrope-Light tidak dipakai.
- QR 220 px dan beberapa conclusion circles fixed 96 px.
- /explore masih starter Expo dan exposed sebagai authenticated route.
- Starter components/assets serta beberapa debug logs masih tersisa.
- Guide menjelaskan arah QR secara tidak konsisten dengan flow: mobile menampilkan QR, Pi yang memindai.
- Target utama Android entry-level/low-mid.

Scope:
- src/app/_layout.tsx
- src/app/index.tsx
- src/app/login.tsx
- src/app/register.tsx
- src/app/home.tsx
- src/app/profile.tsx
- src/app/edit-profile.tsx
- src/app/guide.tsx
- src/app/history.tsx
- src/app/history/[id].tsx
- src/components/navbar.tsx
- assets/images/Logo.png
- exposed starter/dead code yang terbukti tidak direferensikan

Target:
1. Login/register tetap usable saat keyboard terbuka pada small Android screen.
2. Navbar menghormati bottom safe-area/gesture navigation.
3. Semua screen utama punya content inset yang sesuai dan tidak overlap navbar.
4. Hindari route-stack duplication dari navbar tanpa mengganti seluruh navigation architecture.
5. Resize/optimalkan Logo.png ke dimensi wajar dengan tampilan visual sama; jangan generate desain baru.
6. Jangan menurunkan kualitas required launcher/adaptive icon.
7. Buat QR dan detail rows tetap muat pada lebar kecil secara reasonable.
8. Load hanya font yang benar-benar dipakai, tanpa mengganti typography.
9. Koreksi guide pairing.
10. Hapus route /explore atau starter content agar tidak exposed pada release.
11. Hapus hanya dead starter components/assets yang terbukti tidak direferensikan dengan rg.
12. Hapus/degradasi debug logs yang tidak diperlukan; jangan sembunyikan production errors.
13. Jangan melakukan premature optimization atau menambah library.

Acceptance:
- Source-level review pada width sekitar 320–360dp tidak menunjukkan clipped auth actions.
- Keyboard tidak membuat Sign In/Sign Up unreachable.
- Gesture navigation tidak menutupi navbar.
- Detail action buttons tidak tertutup.
- Logo tidak lagi 4320x4320.
- Tidak ada accessible Expo starter screen.
- Pairing guide sesuai mobile QR → Pi camera.
- Tidak ada functional regression Stage 1–3.

Run:
- npx tsc --noEmit
- npm run lint
- npx expo-doctor --verbose
- git diff --check

Laporkan asset dimensions before/after dan semua file dead yang dihapus.
Jangan auto commit.
```

## T. Ready-to-Paste Prompt — Stage 5

```text
Selesaikan Stage 5 MelanoSense: reproducible Android APK/AAB release configuration.

Sebelum code:
- Baca AGENTS.md dan exact Expo SDK 56 docs.
- Baca official EAS build/app-version/APK docs yang berlaku saat task dijalankan.
- Audit git status/diff; jaga perubahan Stage 1–4.
- Jangan auto commit.
- Jangan deploy backend.
- Jangan menjalankan cloud build sebelum meminta izin eksplisit.
- Jangan upgrade Expo/React Native major secara diam-diam.

Current state:
- app.json: Expo 56, version 1.0.0, owner ucupys-team, EAS project ID ada, scheme melanosense ada.
- android.package tidak ada.
- android.versionCode tidak ada.
- eas.json tidak ada.
- package-lock.json dihapus; pnpm-lock.yaml dan pnpm-workspace.yaml ada tetapi sebelumnya untracked.
- package.json tidak memiliki packageManager.
- Expo config valid.
- Expo Doctor 21/22: Expo 56.0.21/RN 0.85.3 memakai Hermes V1 dengan known memory regression.
- No APK/AAB artifact.
- .env hanya memakai EXPO_PUBLIC Supabase URL/publishable key, tetapi release environment strategy belum final.
- OAuth release redirect allowlist UNVERIFIED.

Target:
1. Temukan Android application ID yang sudah terdaftar di EAS/project metadata bila dapat dibaca secara non-mutating.
2. Jika tidak ada authoritative package ID, jangan menebak; tanyakan user satu pertanyaan singkat sebelum edit.
3. Tambahkan android.package dan positive android.versionCode.
4. Buat eas.json minimal:
   - preview/internal profile menghasilkan installable APK
   - production profile menghasilkan AAB
   - version policy deterministic
5. Putuskan satu package manager berdasarkan working tree saat ini; jangan mempertahankan lockfile ganda.
6. Deklarasikan packageManager bila sesuai dan jangan regenerate/install dependency tanpa izin.
7. Pastikan public Supabase config tersedia untuk build tanpa memasukkan service-role/device secret/PAT.
8. Verifikasi OAuth scheme/callback release; external provider config yang tidak dapat dilihat tetap UNVERIFIED.
9. Periksa icon/adaptive icon/splash resolved config.
10. Jalankan Expo config dan diagnostic checks.
11. Tangani Hermes regression sebagai explicit release gate:
    - cek solusi resmi terbaru;
    - jangan major-upgrade tanpa persetujuan user;
    - jika tidak ada fix kompatibel SDK 56, berhenti dan minta keputusan untuk SDK 57 migration;
    - jangan menekan/ignore Doctor warning tanpa risk acceptance.

Acceptance:
- npx expo config --type public menunjukkan Android package/versionCode.
- eas.json memiliki APK preview dan AAB production profiles.
- hanya satu final lockfile strategy.
- typecheck dan lint lulus.
- expo-doctor pass, atau satu Hermes blocker tercatat dan menunggu explicit approval.
- tidak ada secret server-side di mobile/build config.
- git diff --check lulus.

Run:
- npx tsc --noEmit
- npm run lint
- npx expo-doctor --verbose
- npx expo config --type public
- git diff --check

Jangan memulai EAS build, signing change, commit, atau major upgrade tanpa izin eksplisit.
```

## U. Ready-to-Paste Prompt — Stage 6

```text
Jalankan Stage 6 MelanoSense: physical APK acceptance dan release-candidate verification.

Preconditions:
- Stage 1–5 sudah selesai.
- Typecheck/lint sudah pass.
- Android package ID, versionCode, eas.json, environment, dan Hermes decision sudah final.
- Real Supabase test project/device dan Raspberry Pi tersedia.

Rules:
- Audit git status/diff terlebih dahulu.
- Jangan auto commit.
- Jangan deploy backend atau memulai EAS cloud build tanpa meminta izin eksplisit.
- Jangan mengubah schema/API atau membuat migration.
- Jangan refactor.
- Jika test menemukan bug, reproduksi dan laporkan evidence dahulu; lakukan hanya minimal scoped fix yang disetujui.
- Jangan memakai data pasien nyata.

Preflight:
- npx tsc --noEmit
- npm run lint
- npx expo-doctor --verbose
- npx expo config --type public
- git diff --check
- Verifikasi tidak ada service-role key, PAT, DEVICE_INGEST_SECRET, atau private credential di mobile artifact config.

Setelah izin cloud build:
1. Build preview/internal Android APK.
2. Catat build profile, app version, versionCode, package ID, artifact type, dan build result.
3. Install pada minimal satu physical low/mid Android.
4. Jalankan acceptance matrix berikut:

AUTH
- fresh install membuka public flow
- register
- login salah/benar
- close app/reopen tetap login
- expired/invalid session kembali ke public flow
- logout lalu Back tidak membuka private screen
- Google/Apple hanya PASS jika benar-benar terkonfigurasi

PROFILE
- missing profile/field
- edit/save semua required fields
- invalid date/phone
- offline/fetch error/retry
- focus refresh dan pull refresh

DEVICE
- mobile menampilkan raw-token QR
- Pi memindai QR
- database connected state berubah
- mobile berubah ke connected melalui Realtime
- ulangi dengan Realtime unavailable untuk polling fallback
- device last-seen masuk akal
- no duplicate subscription/request storm

SCAN
- existing scan tidak menyelesaikan process
- user lain insert tidak menyelesaikan process
- real Pi capture menghasilkan row + image
- Realtime dan polling race hanya navigate sekali
- direct route menuju /history/[new id]
- Back sebelum scan membersihkan watcher
- offline Pi queue lalu reconnect

HISTORY/DETAIL
- current user only
- pagination/newest-first
- refresh
- signed storage image
- ABCD/diagnosis/status/stage/recommendation null cases
- non_melanoma green
- melanoma/risk red
- pending/unknown neutral
- confidence 0.917 tampil 91.7%, termasuk PDF

PDF/EMAIL
- PDF dibuat, human-readable, disclaimer ada
- share/save works
- email recipient current user
- PDF attachment dapat dibuka
- email app unavailable/cancel/failure behavior

DISCONNECT
- authenticated POST sukses
- token berubah
- connected false
- last_seen null
- mobile menampilkan QR baru
- old token ditolak backend
- Pi behavior setelah revoke dicatat secara eksplisit
- pair ulang dengan QR baru

UI/PERFORMANCE
- keyboard/small screen
- navbar/safe area
- cold start
- repeated navigation
- memory stability selama beberapa scan/detail/PDF cycles

5. Jika APK acceptance lulus, minta izin terpisah sebelum production AAB build.
6. Hasil akhir harus berisi PASS/FAIL/UNVERIFIED per case, link/artifact metadata yang aman, dan daftar blocker tersisa.

Jangan menyebut RELEASE CANDIDATE bila ada P0/P1, lint failure, Hermes release gate, atau core flow yang masih UNVERIFIED.
```

## Final Verdict

**NOT READY**

Alasan singkat: source pairing belum dapat mengubah mobile menjadi connected, `process.tsx` masih fake timer dan tidak menunggu scan database, confidence salah faktor 100, serta konfigurasi APK/AAB belum tersedia. Working tree sudah membawa kemajuan besar—history/detail/storage/PDF/email dan disconnect mobile—tetapi beberapa perubahan penting belum committed, backend disconnect deployment belum terverifikasi, dan lint/Expo Doctor belum lulus.

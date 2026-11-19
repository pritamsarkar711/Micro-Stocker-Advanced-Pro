# Release signing key

`android/keystore/sideload.p12` signs every APK this project publishes.

It exists for one reason: Android only installs an update when the new APK is
signed with the **same** key as the installed one. A key generated per CI run
(as the Android SDK's default debug key is) makes every in-app update fail with
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, which is exactly the "please download the
new APK manually" loop this project is removing.

| Property | Value |
| --- | --- |
| File | `android/keystore/sideload.p12` (PKCS12, committed on purpose) |
| Alias | `sideload` |
| Store / key password | `msap-sideload-2026` |
| Key | RSA 2048 |
| Validity | 30 years (to 2056-11-11) |
| Certificate SHA-256 | `66758a88b91bfc265ed0fa2f81cca01bcbba132b91cd1aa49008c5c300442cc8` |
| Used by | the `release` signing config, which the `debug` build type also uses |

This is **not** the Play Store key. Play App Signing re-signs every upload with
a key Google holds, so this file is never used for a Play release. Keep that
separation: if this key is ever compromised, the impact is limited to sideloaded
installs, and a Play upload can still be re-signed by Google.

## Where the build gets the key

`android/app/signing.gradle`, in this order:

1. **All four environment variables** — `MSAP_ANDROID_KEYSTORE_PATH`,
   `MSAP_ANDROID_KEYSTORE_PASSWORD`, `MSAP_ANDROID_KEY_ALIAS`,
   `MSAP_ANDROID_KEY_PASSWORD`. Set all four or none: a half-configured set fails
   the build instead of silently signing with a different key. The Android
   workflow passes the four matching repository secrets here, so a private key
   can be used without editing any file.
2. **`android/keystore.properties`** (git-ignored) with the keys `storeFile`,
   `storePassword`, `keyAlias`, `keyPassword` — for a local machine that signs
   with its own key.
3. **The committed sideload key above** — the default, so a fresh clone and
   GitHub Actions produce installable updates with no setup.

A build that packages an APK fails if the configured key is missing, rather than
producing an APK signed with a throwaway debug key.

## What verifies it

`.github/workflows/android.yml` builds the release APK and then, before anything
is uploaded:

* runs `apksigner verify` and requires a valid v2 signature,
* compares the signer's certificate SHA-256 with this keystore (or with the
  `MSAP_ANDROID_*` key when one is configured), because a different signer means
  existing installs cannot update,
* reads `versionCode`/`versionName` back out of the APK with `aapt2` and requires
  them to match `package.json` (the tag must match it too),
* refuses a release APK that is marked `debuggable`.

`npm run android:check` performs the parts that need no JDK or Android SDK.

## Rotating the key

Rotating is possible but forces every existing user to uninstall once, because
Android will not accept an update signed by a new key. If it is ever necessary:

1. Generate a new keystore and store it as the four `MSAP_ANDROID_*` secrets.
2. Set the repository variable `MSAP_ANDROID_ALLOW_KEY_ROTATION` to `1` for that
   release, which turns the signer comparison into a warning instead of a
   failure.
3. Say so in the release notes, with the one-time uninstall step, and remove the
   variable afterwards.

Do not rotate without a migration note in the release.

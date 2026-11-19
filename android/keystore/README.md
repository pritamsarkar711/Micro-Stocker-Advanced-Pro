# Sideload signing key

`android/keystore/sideload.p12` signs the APKs attached to GitHub releases.

It exists for one reason: Android only installs an update when the new APK is
signed with the **same** key as the installed one. A key generated per CI run
(as the Android SDK's default debug key is) makes every in-app update fail with
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, which is exactly the "please download the
new APK manually" loop this project is removing.

* Alias: `sideload` · store password `msap-sideload-2026`
* Validity: 30 years · RSA 2048 · PKCS12
* Used by `debug` and `release` build types in `android/app/build.gradle`

This is **not** the Play Store key. Play App Signing re-signs every upload with
a key Google holds, so this file is never used for a Play release. Keep that
separation: if this key is ever compromised, the impact is limited to
sideloaded installs, and a Play upload can still be re-signed by Google.

Rotating the key is possible but forces every existing user to uninstall once.
Do not rotate it without a migration note in the release.

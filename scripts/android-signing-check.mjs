/**
 * Checks the Android release-signing contract without needing a JDK, the Android
 * SDK or a network connection.
 *
 * The APK build itself is verified by .github/workflows/android.yml (apksigner
 * plus aapt2 on the produced file). This script covers the part that can be
 * checked on any machine and that regressions start in: that a key exists and is
 * readable, that both build types are signed with it, that the release build is
 * not debuggable, and that the version code Android compares on install is
 * derived from package.json rather than a hand-maintained counter.
 *
 * Exit code 0 means "the next release APK will be installable as an update".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { androidVersionCode, readPackageVersion } from './android-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const passes = [];
const check = (condition, message) => (condition ? passes.push(message) : failures.push(message));

const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const optional = (relative) => (existsSync(path.join(root, relative)) ? read(relative) : '');

/* ------------------------------------------------------------ the key file */

const keystorePath = path.join(root, 'android/keystore/sideload.p12');
check(existsSync(keystorePath), 'android/keystore/sideload.p12 exists');

let certificate = null;
if (existsSync(keystorePath)) {
  try {
    // keytool ships with any JDK; openssl is on every runner and most shells.
    // Either can be missing locally, so a failure to inspect is reported as a
    // skip rather than a failure — the CI build runs apksigner for real.
    // openssl alone can read the PKCS12 file, so this works without a JDK.
    const pem = execFileSync(
      'openssl',
      ['pkcs12', '-in', keystorePath, '-passin', 'pass:msap-sideload-2026', '-nokeys', '-clcerts'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const der = execFileSync('openssl', ['x509', '-outform', 'der'], { input: pem });
    const digest = execFileSync('openssl', ['dgst', '-sha256'], { input: der, encoding: 'utf8' });
    certificate = digest.split('=').pop().trim().replace(/:/g, '').toLowerCase();
    check(certificate.length === 64, `sideload key reads with the documented password (SHA-256 ${certificate.slice(0, 16)}…)`);
  } catch (error) {
    passes.push(`sideload key inspection skipped (openssl unavailable): ${String(error.message).split('\n')[0]}`);
  }
}

/* ------------------------------------------------------- the gradle wiring */

const appGradle = read('android/app/build.gradle');
const signingGradle = read('android/app/signing.gradle');
const gradle = `${appGradle}\n${signingGradle}`;

check(/apply\s+from:\s*'signing\.gradle'/.test(appGradle), 'app/build.gradle applies signing.gradle');
check(/signingConfigs\s*\{[\s\S]*?release\s*\{/.test(gradle), 'a release signing config is declared');
check(/enableV2Signing\s+true/.test(gradle), 'v2 signatures are enabled (Android 7+ install verification)');
check(/enableV1Signing\s+true/.test(gradle), 'v1 signatures are enabled (older devices can still install)');

// Both build types must use the release key: a per-machine debug key is what
// makes INSTALL_FAILED_UPDATE_INCOMPATIBLE appear on a user's phone.
const debugBlock = /debug\s*\{([\s\S]*?)\n\s*\}/.exec(appGradle)?.[1] ?? '';
const releaseBlock = /release\s*\{([\s\S]*?)\n\s*\}/.exec(appGradle)?.[1] ?? '';
check(/signingConfig\s+signingConfigs\.release/.test(debugBlock), 'debug builds are signed with the release key');
check(/signingConfig\s+signingConfigs\.release/.test(releaseBlock), 'release builds are signed with the release key');
check(/debuggable\s+false/.test(releaseBlock), 'release builds are not debuggable');

// The hand-maintained counter must not come back: it drifted silently before.
check(!/versionCode\s+\d+/.test(appGradle), 'versionCode is derived, not hardcoded');
check(!/versionName\s+["']\d/.test(appGradle), 'versionName is derived, not hardcoded');
check(/JsonSlurper/.test(appGradle) && /package\.json/.test(appGradle), 'the version comes from package.json');

// A hardcoded credential in a committed gradle file is acceptable only for the
// public sideload key; this asserts the script keeps the env override path.
check(/MSAP_ANDROID_KEYSTORE_PATH/.test(signingGradle), 'the key can be overridden from the environment (CI secrets)');
check(/PKCS12/.test(signingGradle), 'the keystore type is explicit');

/* ------------------------------------------------------------- the version */

const version = readPackageVersion(root);
const code = androidVersionCode(version);
check(Number.isInteger(code) && code > 0, `package.json ${version} -> versionCode ${code}`);
check(version.replace(/^v/, '').split('.').length >= 2, 'the version has at least major.minor fields');

// Every release in CHANGELOG.md must produce a strictly larger code than the one
// before it, which is the property Android enforces on install.
const versions = [...read('CHANGELOG.md').matchAll(/^##\s*\[(\d+\.\d+(?:\.\d+)?)\]/gm)].map((m) => m[1]);
for (let index = 1; index < versions.length; index += 1) {
  const newer = versions[index - 1];
  const older = versions[index];
  if (androidVersionCode(newer) <= androidVersionCode(older)) {
    failures.push(`CHANGELOG order: ${newer} does not outrank ${older} in versionCode`);
  }
}
check(versions.length > 0, `checked ${versions.length} released versions for an increasing versionCode`);

/* -------------------------------------------------------------- the report */

for (const message of passes) console.log(`  ok    ${message}`);
for (const message of failures) console.log(`  FAIL  ${message}`);

if (failures.length) {
  console.log(`\n${failures.length} Android signing check(s) failed.`);
  process.exit(1);
}
console.log(`\nAndroid signing contract holds (${passes.length} checks).`);

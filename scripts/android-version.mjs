/**
 * The one place that turns `package.json`'s version into the Android
 * `versionName` / `versionCode` pair.
 *
 * Android refuses to install an update whose `versionCode` is not higher than
 * the installed one, so these two numbers are an update-compatibility contract,
 * not decoration:
 *
 *   - `versionName` is exactly the package version (what the user sees).
 *   - `versionCode` is derived from it (`major * 10000 + minor * 100 + patch`),
 *     which makes every release strictly greater than the previous one without
 *     anyone remembering to bump a hand-written counter.
 *
 * `android/app/build.gradle` implements the same two rules, reading the same
 * `package.json`, so the APK and this script cannot disagree. The Android
 * workflow builds the APK, reads the packaged `versionCode` back out of it with
 * aapt2 and fails if it differs from what this script prints — that is the check
 * that keeps a release installable as an update.
 *
 * Usage:
 *   node scripts/android-version.mjs           # "versionName=2.3.2 versionCode=20302"
 *   node scripts/android-version.mjs --json    # JSON for other tooling
 *   node scripts/android-version.mjs --github-env
 *       # appends `version=...` and `versionCode=...` to $GITHUB_ENV for later steps
 */
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `2.3.2` -> `[2, 3, 2]`, tolerating a leading `v` and pre-release suffixes. */
export function parseSemver(value) {
  const cleaned = String(value).trim().replace(/^v/i, '').split(/[-+]/)[0];
  const parts = cleaned.split('.').map((part) => {
    const digits = Number.parseInt(part.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(digits)) throw new Error(`Not a version: ${value}`);
    return digits;
  });
  if (!parts.length || parts.some((part) => part < 0)) throw new Error(`Not a version: ${value}`);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/**
 * versionCode for a version string. Two digits per field, matching the
 * `major * 10000 + minor * 100 + patch` rule in android/app/build.gradle.
 */
export function androidVersionCode(version) {
  const [major, minor, patch] = parseSemver(version);
  if (minor > 99 || patch > 99) {
    throw new Error(
      `Version ${version} has a minor or patch number above 99, which would collide in the Android versionCode scheme.`,
    );
  }
  return major * 10000 + minor * 100 + patch;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readPackageVersion(from = root) {
  return JSON.parse(readFileSync(path.join(from, 'package.json'), 'utf8')).version;
}

function main(argv) {
  const version = readPackageVersion();
  const versionCode = androidVersionCode(version);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ version, versionCode }, null, 2));
    return;
  }
  if (argv.includes('--github-env')) {
    const target = process.env.GITHUB_ENV;
    if (!target) {
      console.error('GITHUB_ENV is not set; run this step inside GitHub Actions or use --json.');
      process.exit(2);
    }
    appendFileSync(target, `version=${version}\nversionCode=${versionCode}\n`);
    console.log(`version=${version} versionCode=${versionCode}`);
    return;
  }
  console.log(`versionName=${version} versionCode=${versionCode}`);
}

// Only run the CLI when this file itself is executed. `import.meta.url` is also
// compared by name because the unit tests bundle this module with esbuild, where
// import.meta.url becomes the bundle's path and a plain path comparison would
// make an imported helper start printing to stdout.
const invokedDirectly =
  path.basename(fileURLToPath(import.meta.url)) === 'android-version.mjs' &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

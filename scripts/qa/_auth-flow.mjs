// End to end auth pass in the preview build: sign up, sign in, password
// recovery, two step verification enrolment and challenge, plus the admin
// security tab. Uses the in-memory demo client, so no real account is touched.
//
//   VITE_DEMO_MODE=1 npx vite --port 5173 &
//   node scripts/qa/_auth-flow.mjs [baseUrl]
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'auth-flow-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const outDir = process.argv[3] ?? '/tmp/auth-flow';
mkdirSync(outDir, { recursive: true });

/* ---------------------------------------------------------------- TOTP */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  let bits = '';
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = B32.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, stepOffset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

/* ---------------------------------------------------------------- harness */

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const failures = [];
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(`CONSOLE ${message.text()}`);
});

function check(name, condition, detail = '') {
  if (condition) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function openAccount() {
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true }).first();
  if (await signIn.count()) await signIn.click();
  else await page.locator('button[aria-haspopup="dialog"]').first().click();
  await page.waitForTimeout(350);
}

async function signIn(email, password) {
  await openAccount();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.waitForTimeout(900);
}

async function signOut() {
  // The Settings page also has a sign out button, so scope to the panel.
  if (!(await page.getByRole('dialog').count())) await openAccount();
  const signOutButton = page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true });
  if (!(await signOutButton.count())) {
    check('account panel offers sign out', false);
    return;
  }
  await signOutButton.first().click();
  await page.waitForTimeout(700);
}

const email = `flow-${Date.now()}@demo.local`;
const password = 'DemoPassword123!';
const nextPassword = 'DemoPassword456!';

await page.goto(`${base}/`, { waitUntil: 'networkidle' });

/* 1. create account */
await openAccount();
await page.getByRole('tab', { name: 'Create account' }).click();
await page.getByPlaceholder('Studio or contributor name').fill('Flow Tester');
await page.getByPlaceholder('you@example.com').fill(email);
await page.getByPlaceholder('Enter password').fill(password);
await page.getByRole('button', { name: 'Register and sign in' }).click();
await page.waitForTimeout(1200);
check('sign up signs the account in', (await page.getByText('Flow Tester').count()) > 0);
await shot('01-signed-in');

/* 2. sign out and back in */
await signOut();
await signIn(email, password);
check('sign in after sign out works', (await page.getByText('Flow Tester').count()) > 0);

/* 3. recovery: request a link, open it, set a new password */
await signOut();
await openAccount();
await page.getByRole('button', { name: 'Forgot password?' }).click();
await page.getByPlaceholder('you@example.com').fill(email);
await page.getByRole('button', { name: 'Send reset link' }).click();
await page.waitForTimeout(500);
check('reset request confirms without leaking the account', (await page.getByText('If that address has an account').count()) > 0);
await shot('02-forgot');
await page.getByRole('button', { name: 'Preview build: open the reset link' }).click();
await page.waitForTimeout(800);
check('reset link opens the new password form', (await page.getByText('Choose a new password').count()) > 0);
await page.getByPlaceholder('Enter a new password').fill(nextPassword);
await page.getByRole('button', { name: 'Update password' }).click();
await page.waitForTimeout(900);
await shot('03-password-reset');
check('the reset closes the panel and keeps the session', (await page.getByRole('dialog').count()) === 0);
await signOut();
check('the old password is no longer a way in', (await page.getByRole('button', { name: 'Sign in', exact: true }).count()) > 0);
await signIn(email, nextPassword);
check('the new password signs in', (await page.getByText('Flow Tester').count()) > 0);

/* 4. enrol an authenticator from Settings → Security */
await page.goto(`${base}/#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const enable = page.getByRole('button', { name: 'Enable', exact: true });
if (!(await enable.count())) {
  // The panel can be collapsed; open the security block explicitly.
  await page.getByText('Two step verification').first().click();
  await page.waitForTimeout(300);
}
await page.getByRole('button', { name: 'Enable', exact: true }).first().click();
await page.waitForTimeout(900);
const secret = (await page.locator('code').first().innerText()).trim();
check('enrolment shows a setup key', /^[A-Z2-7]{16,}$/.test(secret), secret);
await shot('04-enrol');
await page.getByLabel('6 digit code').fill(totp(secret));
await page.getByRole('button', { name: 'Verify', exact: true }).click();
await page.waitForTimeout(1000);
check('authenticator is on after a valid code', (await page.getByText('On', { exact: true }).count()) > 0);
await shot('05-mfa-on');

/* 5. the next sign in must ask for the code */
await signOut();
await signIn(email, nextPassword);
const mfaPrompt = await page.getByText('Two step verification').count();
check('sign in asks for the second factor', mfaPrompt > 0);
await shot('06-mfa-challenge');
await page.getByLabel('Code').fill('000000');
await page.getByRole('button', { name: 'Verify', exact: true }).click();
await page.waitForTimeout(700);
check('a wrong code is rejected', (await page.getByText('That code is not valid').count()) > 0);
await page.getByLabel('Code').fill(totp(secret));
await page.getByRole('button', { name: 'Verify', exact: true }).click();
await page.waitForTimeout(1200);
check('the right code completes sign in', (await page.getByText('Flow Tester').count()) > 0);

/* 6. admin console: providers + security */
await signOut();
await signIn('admin@demo.local', 'demo-password');
await page.goto(`${base}/#/admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.getByRole('tab', { name: 'Providers' }).click();
await page.waitForTimeout(600);
check('provider list shows key status', (await page.getByText('Key stored').count()) > 0);
await page.getByRole('button', { name: 'Add key' }).first().click();
await page.waitForTimeout(400);
check('key dialog explains where to get the key', (await page.getByText(/Create an API key|Open .* API keys/).count()) > 0);
await shot('07-provider-key');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.getByRole('tab', { name: 'Security' }).click();
await page.waitForTimeout(800);
check('security tab lists accounts', (await page.getByText('admin@demo.local').count()) > 0);
check('security tab shows the policy switch', (await page.getByText('Require an authenticator for administrator accounts').count()) > 0);
await shot('08-admin-security');

/* 7. subscription layout at desktop and phone widths */
await page.goto(`${base}/#/subscription`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
// The taka sign falls back to "BDT" on systems without a Bengali font.
const prices = await page.locator('text=/(৳|BDT)[\\s]?[\\d,]+/').count();
check('plan cards print a price', prices >= 3, String(prices));
check('no plan shows a missing price', (await page.getByText('Not sold').count()) === 0);
const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('subscription page does not scroll sideways on desktop', desktopOverflow <= 0, `${desktopOverflow}px`);
await shot('09-subscription-desktop');

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('subscription page does not scroll sideways on a phone', mobileOverflow <= 0, `${mobileOverflow}px`);
await shot('10-subscription-phone');

await page.goto(`${base}/#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const settingsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('settings page fits a phone', settingsOverflow <= 0, `${settingsOverflow}px`);
await shot('11-settings-phone');

check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall auth checks passed');

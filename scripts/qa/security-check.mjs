/**
 * Account security regression walk: password change form, TOTP enrolment with a
 * real authenticator code, sign out, and the sign-in challenge.
 *
 *   node scripts/qa/security-check.mjs        (expects `npm run dev:renderer` with VITE_DEMO_MODE=1)
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'security-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;
mkdirSync('/tmp/shots', { recursive: true });

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret) {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = B32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(Date.now() / 30000), 4);
  const digest = crypto.createHmac('sha1', Buffer.from(bytes)).update(buffer).digest();
  const start = digest[19] & 0x0f;
  const code = ((digest[start] & 0x7f) << 24) | (digest[start + 1] << 16) | (digest[start + 2] << 8) | digest[start + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

const checks = [];
const ok = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });
const errors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
});
await page.goto('http://127.0.0.1:5173/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

ok('security panel', (await page.getByText('Two step verification').count()) > 0);
await page.getByRole('button', { name: 'Enable', exact: true }).click();
await page.waitForTimeout(400);
const secret = (await page.locator('code').first().textContent())?.trim() ?? '';
ok('totp key issued', /^[A-Z2-7]{20,}$/.test(secret), secret.slice(0, 6));
await page.getByLabel('6 digit code').fill(totp(secret));
await page.getByRole('button', { name: 'Verify', exact: true }).click();
await page.waitForTimeout(700);
ok('totp enabled', (await page.getByText('On', { exact: true }).count()) > 0);

await page.getByRole('button', { name: 'Change', exact: true }).first().click();
await page.waitForTimeout(200);
ok('change password form', (await page.getByLabel('Current password').count()) > 0);
await page.getByLabel('Current password').fill('password123');
await page.getByLabel('New password', { exact: true }).fill('newpassword123');
await page.getByLabel('Repeat new password').fill('newpassword123');
await page.getByRole('button', { name: 'Save password' }).click();
await page.waitForTimeout(600);
ok('password saved', (await page.getByText('Password updated').count()) > 0);
await page.screenshot({ path: '/tmp/shots/security-on.png' });

await page.goto('http://127.0.0.1:5173/#/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
ok('fresh session asks for code', (await page.getByLabel('Code').count()) > 0);
if (await page.getByLabel('Code').count()) {
  await page.getByLabel('Code').fill(totp(secret));
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.waitForTimeout(900);
}
ok('code accepted after reload', (await page.getByText('Library & Metadata').count()) > 0);

await page.goto('http://127.0.0.1:5173/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const signOut = page.getByRole('button', { name: 'Sign out', exact: true }).first();
ok('sign out available', (await signOut.count()) > 0);
if (await signOut.count()) await signOut.click();
await page.waitForTimeout(800);

const signIn = page.getByRole('button', { name: 'Sign in', exact: true }).first();
if (await signIn.count()) await signIn.click();
await page.waitForTimeout(500);
if (!(await page.getByLabel('Email').count())) {
  await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
}
await page.getByLabel('Email').fill('admin@demo.local');
await page.getByLabel('Password', { exact: true }).fill('password123');
await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
await page.waitForTimeout(900);
ok('sign in asks for code', (await page.getByLabel('Code').count()) > 0);
await page.getByLabel('Code').fill(totp(secret));
await page.getByRole('button', { name: 'Verify', exact: true }).click();
await page.waitForTimeout(900);
ok('code accepted at sign-in', (await page.getByText('Studio Admin').count()) > 0);

ok('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
console.log(JSON.stringify({ checks, failed: checks.filter((check) => !check.pass).length }, null, 1));
process.exit(checks.some((check) => !check.pass) ? 1 : 0);

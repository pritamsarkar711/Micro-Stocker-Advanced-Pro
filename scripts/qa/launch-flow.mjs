/**
 * Walks the first-run experience the way a new phone user sees it: splash,
 * welcome, three tour slides, registration, dashboard. Every stage is captured
 * so a regression in copy or layout is obvious.
 *
 *   node scripts/qa/launch-flow.mjs /tmp/launch
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'lf-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/launch';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });

const checks = [];
const shot = async (name) => page.screenshot({ path: path.join(out, `${name}.png`) });

await page.waitForTimeout(300);
checks.push(`splash visible: ${await page.getByText('Contributor studio').first().isVisible()}`);
checks.push(`dashboard not mounted during launch: ${(await page.locator('#workspace-main').count()) === 0}`);
await shot('01-splash');

await page.getByRole('button', { name: 'Get started' }).waitFor({ timeout: 6000 });
await page.waitForTimeout(300);
await shot('02-welcome');
await page.getByRole('button', { name: 'Get started' }).click();

await page.waitForTimeout(350);
checks.push(`tour step 1: ${await page.getByText('Titles and keywords, drafted from the picture').isVisible()}`);
await shot('03-tour-1');

await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(300);
checks.push(`tour step 2: ${await page.getByText('One library, fourteen marketplaces').isVisible()}`);
await shot('04-tour-2');

await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(300);
checks.push(`tour step 3: ${await page.getByText('Upscale, cut out and convert on the phone').isVisible()}`);
await shot('05-tour-3');

// The tour's own sign-in shortcut for people who already have an account.
checks.push(`tour sign-in shortcut: ${await page.getByRole('button', { name: 'I already have an account' }).isVisible()}`);
await page.getByRole('button', { name: 'I already have an account' }).click();
await page.waitForTimeout(400);
checks.push(`auth screen: ${await page.getByRole('tab', { name: 'Create account' }).isVisible()}`);
await shot('06-auth');

await page.getByRole('tab', { name: 'Create account' }).click();
await page.waitForTimeout(200);
await page.getByLabel('Email').first().fill('newuser@demo.local');
await page.getByLabel('Password', { exact: true }).fill('supersecret1');
await shot('07-register-filled');
await page.getByRole('button', { name: 'Create account' }).click();

// The phone layout hides the page h1, so the app bar title is the proof that
// the dashboard, not the launch flow, is on screen.
await page.locator('header').getByText('Overview', { exact: true }).waitFor({ timeout: 12000 });
checks.push('dashboard reached after registration: true');
checks.push(`launch flag stored: ${await page.evaluate(() => localStorage.getItem('msap.launch.done'))}`);
await page.waitForTimeout(400);
await shot('08-dashboard');

// A second cold start must not repeat the tour.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
checks.push(
  `second start skips the tour: ${await page
    .locator('header')
    .getByText('Overview', { exact: true })
    .isVisible()
    .catch(() => false)}`,
);
await shot('09-second-start');

console.log(checks.join('\n'));
console.log(errors.length ? `errors: ${errors.slice(0, 4).join(' | ')}` : 'no page errors');
await browser.close();

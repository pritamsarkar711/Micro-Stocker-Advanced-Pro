/**
 * Opens Admin → Providers, screenshots the card, opens both new dialogs and
 * closes them again so a broken modal shows up here rather than in a release.
 *
 *   node scripts/qa/_adminprov.mjs /tmp/shots6   (needs the demo dev server)
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'ap-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/shots6';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001'); });

await page.goto('http://127.0.0.1:5173/#/admin', { waitUntil: 'networkidle' });
await page.getByText('Providers', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, 'providers.png'), fullPage: true });

const report = [];
for (const label of ['Add provider', 'Add model']) {
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(400);
  const visible = await page.getByText(label === 'Add provider' ? 'Save provider' : 'Save model').isVisible();
  report.push(`${label}: dialog ${visible ? 'opened' : 'missing'}`);
  if (visible) await page.screenshot({ path: path.join(out, `${label.toLowerCase().replace(' ', '-')}.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
console.log(report.join(' | '));
console.log(errors.length ? `errors: ${errors.slice(0, 4).join(' | ')}` : 'no page errors');
await browser.close();

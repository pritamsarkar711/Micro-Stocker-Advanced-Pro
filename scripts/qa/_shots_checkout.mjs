import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 's3-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/shots-checkout';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
});

await page.goto('http://127.0.0.1:5173/#/subscription', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.getByRole('button', { name: /choose plan/i }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, 'checkout-bkash.png') });

// Crypto tile is the third payment option.
const tiles = page.locator('button').filter({ hasText: /crypto/i });
if (await tiles.count()) {
  await tiles.first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'checkout-crypto.png') });
}
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.goto('http://127.0.0.1:5173/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const payments = page.getByRole('tab', { name: /payments/i });
if (await payments.count()) {
  await payments.first().click();
  await page.waitForTimeout(700);
}
await page.screenshot({ path: path.join(out, 'admin-payments.png'), fullPage: true });

console.log(errors.length ? `errors: ${errors.slice(0, 4).join(' | ')}` : 'no page errors');
await browser.close();

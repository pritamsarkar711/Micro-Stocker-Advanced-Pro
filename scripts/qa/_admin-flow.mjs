// Admin console interaction pass: every tab, then approve the pending order.
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'admin-flow-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
const outDir = '/tmp/shots-admin';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder('you@example.com').fill('admin@demo.local');
await page.getByPlaceholder('Enter password').fill('demo-password');
await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
await page.waitForTimeout(1200);
await page.goto('http://127.0.0.1:5173/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

for (const tab of ['Overview', 'Users', 'Plans', 'Providers', 'Settings']) {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, `${tab.toLowerCase()}.png`), fullPage: true });
}

// Approve the pending order, then confirm it left the queue.
await page.getByRole('tab', { name: /^Orders/ }).click();
await page.waitForTimeout(500);
const approve = page.getByRole('button', { name: 'Approve' }).first();
const hadPending = (await approve.count()) > 0;
if (hadPending) {
  await approve.click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: path.join(outDir, 'orders-after.png'), fullPage: true });
const toast = await page.locator('[data-toast], .toast, [role="status"]').allInnerTexts().catch(() => []);
console.log(hadPending ? `approved one order; toasts: ${toast.join(' | ')}` : 'no pending order to approve');
console.log(errors.length ? `errors: ${errors.slice(0, 6).join(' | ')}` : 'no page errors');
await browser.close();

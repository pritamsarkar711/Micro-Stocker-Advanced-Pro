// Signed-in screenshot pass: opens the account modal, signs in, then captures
// the Pro and admin surfaces. Demo mode only.
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'signed-shot-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const email = process.argv[2] ?? 'admin@demo.local';
const outDir = process.argv[3] ?? '/tmp/shots-signed';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForTimeout(400);
await page.getByPlaceholder('you@example.com').fill(email);
await page.getByPlaceholder('Enter password').fill('demo-password');
await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
await page.waitForTimeout(1500);

for (const [name, route] of [['admin', 'admin'], ['subscription', 'subscription'], ['video', 'video-upscale'], ['upscale', 'upscale'], ['generate-jpg', 'generate/jpg']]) {
  await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

console.log(errors.length ? `errors: ${errors.slice(0, 6).join(' | ')}` : 'no page errors');
await browser.close();

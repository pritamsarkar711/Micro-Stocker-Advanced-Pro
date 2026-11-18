// Loads the built bundle from a static server, like the Vercel deployment does.
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'build-check-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const base = process.argv[2] ?? 'http://127.0.0.1:8099';
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });

for (const route of ['', '/#/subscription', '/#/admin', '/#/video-upscale']) {
  await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const heading = await page.locator('h1, h2').first().innerText().catch(() => '');
  console.log(`${route || '/'} -> ${heading.replace(/\s+/g, ' ').slice(0, 40)}`);
}
await page.screenshot({ path: '/tmp/build-check.png', fullPage: false });
console.log(errors.length ? `errors: ${errors.slice(0, 5).join(' | ')}` : 'no page errors');
await browser.close();

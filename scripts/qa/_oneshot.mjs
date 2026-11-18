/**
 * Screens a single route at one phone size, for iterating on a specific page.
 *   node scripts/qa/_oneshot.mjs /tmp/shot <route> [width] [height]
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'os-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/shot';
const route = process.argv[3] ?? '';
const width = Number(process.argv[4] ?? 360);
const height = Number(process.argv[5] ?? 740);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.demo.email', 'admin@demo.local');
  localStorage.setItem('msap.launch.done', '1');
});
await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2700);
const name = (route || 'home').replace(/\//g, '-');
await page.screenshot({ path: path.join(out, `${name}.png`) });
// Also capture the page scrolled to the bottom, where fixed bars overlap content.
await page.evaluate(() => {
  const main = document.getElementById('workspace-main');
  if (main) main.scrollTop = main.scrollHeight;
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, `${name}-bottom.png`) });
await browser.close();
console.log('saved', name);

import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
const scratch = mkdtempSync(path.join(tmpdir(), 's4-'));
writeFileSync(path.join(scratch,'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar',['xf',path.join(scratch,'libs.tar'),'-C',scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch,'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
const out = process.argv[2] ?? '/tmp/sc3';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { localStorage.setItem('msap.demo.session','d0000000-0000-4000-8000-000000000001'); });
for (const [name, route] of [['bgremove','bg-remove'],['upscale','upscale'],['video','video-upscale']]) {
  await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
}
console.log(errors.length ? `errors: ${errors.slice(0,3).join(' | ')}` : 'no page errors');
await browser.close();

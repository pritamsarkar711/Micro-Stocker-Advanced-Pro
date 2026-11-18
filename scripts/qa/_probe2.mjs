import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
const scratch = mkdtempSync(path.join(tmpdir(), 'p2-'));
writeFileSync(path.join(scratch,'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar',['xf',path.join(scratch,'libs.tar'),'-C',scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch,'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session','d0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.demo.email','admin@demo.local');
  localStorage.setItem('msap.launch.done','1');
});
await page.goto('http://127.0.0.1:5173/#/generate/eps', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => {
  const texts = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent||'').trim()).slice(0, 20);
  return JSON.stringify({ buttons: texts, bodyStart: document.body.innerText.slice(0, 120) });
}));
await browser.close();

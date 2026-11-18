import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
const scratch = mkdtempSync(path.join(tmpdir(), 'of-'));
writeFileSync(path.join(scratch,'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar',['xf',path.join(scratch,'libs.tar'),'-C',scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch,'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session','d0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.launch.done','1');
});
await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3200);
const out = await page.evaluate(() => {
  console.log('doc', document.documentElement.scrollWidth, 'main', document.getElementById('workspace-main')?.scrollWidth);
  const rows = [];
  const vw = window.innerWidth;
  const walk = (el, depth) => {
    if (depth > 14) return;
    for (const child of el.children) {
      const r = child.getBoundingClientRect();
      if (r.right > vw + 1) {
        rows.push({ tag: child.tagName, cls: (child.className||'').toString().slice(0, 140), w: Math.round(r.width), right: Math.round(r.right), depth, text: (child.textContent||'').trim().slice(0,40) });
      }
      walk(child, depth+1);
    }
  };
  walk(document.querySelector('main') ?? document.body, 0);
  return { doc: document.documentElement.scrollWidth, main: document.getElementById('workspace-main')?.scrollWidth, client: document.getElementById('workspace-main')?.clientWidth, rows: rows.slice(0, 12) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();

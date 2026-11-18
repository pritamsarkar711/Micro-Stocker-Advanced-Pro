import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
const scratch = mkdtempSync(path.join(tmpdir(), 'pr-'));
writeFileSync(path.join(scratch,'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar',['xf',path.join(scratch,'libs.tar'),'-C',scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch,'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session','d0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.demo.email','admin@demo.local');
  localStorage.setItem('msap.launch.done','1');
});
await page.goto(`http://127.0.0.1:5173/#/${process.argv[2] ?? ''}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Generate');
  if (!btn) return { found: false };
  const bar = btn.parentElement;
  const cs = getComputedStyle(bar);
  const r = bar.getBoundingClientRect();
  const chain = [];
  let node = bar.parentElement;
  while (node) {
    const s = getComputedStyle(node);
    if (s.transform !== 'none' || s.filter !== 'none' || s.perspective !== 'none' || s.willChange !== 'auto' || s.contain !== 'none')
      chain.push({ tag: node.tagName, cls: (node.className||'').toString().slice(0,60), transform: s.transform, filter: s.filter, willChange: s.willChange, contain: s.contain });
    node = node.parentElement;
  }
  return { found: true, position: cs.position, bottom: cs.bottom, rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }, chain };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

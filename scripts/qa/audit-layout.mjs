import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'audit-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;

mkdirSync('/tmp/shots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001'); } catch {} });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 80)); });
page.on('pageerror', e => errs.push('PAGE ' + e.message.slice(0, 90)));

const routes = ['', 'library', 'prepare', 'export', 'vector', 'quality', 'optimize', 'upscale', 'video-upscale', 'bg-remove', 'convert', 'planner', 'plan', 'platforms', 'releases', 'bank', 'cloud', 'subscription', 'admin', 'settings', 'contact', 'report', 'about', 'earnings'];
const widths = [375, 768, 1280, 1680];
const shots = new Set(process.env.SHOTS ? process.env.SHOTS.split(',') : ['', 'vector', 'quality', 'optimize', 'platforms', 'library', 'settings']);

let problems = 0;
for (const w of widths) {
  await page.setViewportSize({ width: w, height: w < 700 ? 780 : 900 });
  console.log(`\n=== ${w}px ===`);
  for (const r of routes) {
    errs.length = 0;
    await page.goto(`http://127.0.0.1:5173/#/${r}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(650);
    const res = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - window.innerWidth;
      const offenders = [];
      if (overflow > 1) {
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 1 && rect.width > 8 && rect.height > 8) {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed') continue;
            offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}@${Math.round(rect.right)}`);
            if (offenders.length > 2) break;
          }
        }
      }
      return { overflow, offenders, scrollH: de.scrollHeight };
    });
    const bad = errs.length || res.overflow > 1;
    if (bad) problems++;
    const label = (r || 'overview').padEnd(14);
    console.log(`${label} ${bad ? 'FAIL' : 'ok  '} overflow=${res.overflow} ${res.offenders.join(' ')} ${errs.slice(0, 2).join(' || ')}`);
    if (w === 1680 && shots.has(r) && !errs.length) {
      await page.screenshot({ path: `/tmp/shots/a-${r || 'overview'}-${w}.png`, fullPage: true });
    }
    if (w === 375 && shots.has(r) && !errs.length) {
      await page.screenshot({ path: `/tmp/shots/m-${r || 'overview'}-375.png`, fullPage: true });
    }
  }
}
console.log(`\nPROBLEMS: ${problems}`);
await browser.close();
rmSync(scratch, { recursive: true, force: true });

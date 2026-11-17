import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
const scratch = mkdtempSync(path.join(tmpdir(), 'font-'));
writeFileSync(path.join(scratch,'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar',['xf',path.join(scratch,'libs.tar'),'-C',scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch,'lib')}:${process.env.LD_LIBRARY_PATH||''}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const failed = [];
page.on('requestfailed', r => failed.push(r.url() + ' ' + r.failure()?.errorText));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const info = await page.evaluate(async () => {
  await document.fonts.ready;
  const loaded = [...document.fonts].map(f => `${f.family} ${f.weight} ${f.style} ${f.status}`);
  const probe = (family) => { const c = document.createElement('canvas').getContext('2d'); c.font = `40px ${family}`; return c.measureText('Handgloves typography 123').width; };
  return {
    loaded,
    checkJakarta: document.fonts.check('16px "Plus Jakarta Sans"'),
    bodyFont: getComputedStyle(document.body).fontFamily,
    titleFont: getComputedStyle(document.querySelector('h1,h2') ?? document.body).fontFamily,
    widthJakarta: probe('Plus Jakarta Sans'),
    widthArial: probe('Arial'),
    widthSerif: probe('serif'),
  };
});
console.log(JSON.stringify(info, null, 1));
console.log('failed requests', failed.slice(0,5));
await browser.close(); rmSync(scratch,{recursive:true,force:true});

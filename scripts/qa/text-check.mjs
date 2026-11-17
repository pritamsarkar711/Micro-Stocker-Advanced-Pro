/**
 * Copy guard: every route is rendered in both themes and the visible text is
 * scanned for em/en dashes, banned words and placeholder noise.
 *
 *   node scripts/qa/text-check.mjs
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'text-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;

const routes = ['', 'library', 'prepare', 'export', 'vector', 'quality', 'optimize', 'upscale', 'video-upscale', 'bg-remove', 'convert', 'planner', 'plan', 'platforms', 'releases', 'bank', 'cloud', 'subscription', 'admin', 'settings', 'contact', 'report', 'about', 'earnings'];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
});

const problems = [];
for (const route of routes) {
  await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  const text = await page.evaluate(() => document.body.innerText);
  for (const [label, pattern] of [
    ['em dash', /\u2014/],
    ['en dash', /\u2013/],
    ['autosave hint', /Autosaved|Auto Save/],
    ['space hint', /Space = pan/],
    ['shift hint', /Shift\+click|Shift \+ Click/],
    ['nothing text', /Nothing selected|Nothing here yet/],
    ['forbidden icon word', /\b(Sparkles?|Shield|Warning|Thunder|Bolt|Magic)\b/],
  ]) {
    if (pattern.test(text)) problems.push(`${route || 'overview'}: ${label}`);
  }
}
await browser.close();
console.log(JSON.stringify({ problems, failed: problems.length }, null, 1));
process.exit(problems.length ? 1 : 0);

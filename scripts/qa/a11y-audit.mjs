/**
 * Accessibility audit with axe-core on every route, light and dark.
 *
 *   node scripts/qa/a11y-audit.mjs
 *   ROUTES=vector,quality node scripts/qa/a11y-audit.mjs
 *
 * Fails on serious and critical violations (contrast, names, roles, focus).
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const scratch = mkdtempSync(path.join(tmpdir(), 'a11y-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;

const routes = (process.env.ROUTES ?? 'overview,library,prepare,export,vector,quality,optimize,upscale,video-upscale,bg-remove,convert,planner,platforms,releases,bank,cloud,subscription,admin,settings,contact,report,about,earnings').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()), args: chromiumBinary.args, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  try {
    localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
    localStorage.setItem('msap:data:msap:settings', JSON.stringify({ theme: 'light' }));
  } catch {}
});
const page = await context.newPage();

const findings = [];
for (const theme of ['light', 'dark']) {
  await page.goto('http://127.0.0.1:5173/#/settings', { waitUntil: 'networkidle' });
  await page.evaluate((next) => {
    const raw = localStorage.getItem('msap:data:msap:settings');
    const settings = raw ? JSON.parse(raw) : {};
    settings.theme = next;
    localStorage.setItem('msap:data:msap:settings', JSON.stringify(settings));
  }, theme);
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:5173/#/${route === 'overview' ? '' : route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    await page.evaluate(axeSource);
    const result = await page.evaluate(async () => {
      const out = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        resultTypes: ['violations'],
      });
      return out.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
        samples: violation.nodes.slice(0, 2).map((node) => ({
          target: node.target.join(' '),
          html: String(node.html).slice(0, 220),
          summary: String(node.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220),
        })),
      }));
    });
    for (const violation of result) {
      if (!['serious', 'critical'].includes(violation.impact)) continue;
      findings.push({ theme, route, ...violation });
      for (const sample of violation.samples ?? []) console.log(`${theme} ${route} > ${sample.html}`);
      if (process.env.VERBOSE) {
        console.log(`${theme} ${route} ${violation.id}: ${violation.help}`);
        for (const sample of violation.samples ?? []) {
          console.log(`    ${sample.target}`);
          console.log(`      ${sample.html}`);
          console.log(`      ${sample.summary}`);
        }
      }
    }
  }
}

await browser.close();
rmSync(scratch, { recursive: true, force: true });

const grouped = new Map();
for (const finding of findings) {
  const key = `${finding.theme} | ${finding.id} | ${finding.nodes[0] ?? ''}`;
  grouped.set(key, (grouped.get(key) ?? 0) + 1);
}
for (const [key, count] of grouped) console.log(`${count}x ${key}`);
console.log(`\nSERIOUS/CRITICAL: ${findings.length} (${grouped.size} unique)`);
process.exit(findings.length ? 1 : 0);

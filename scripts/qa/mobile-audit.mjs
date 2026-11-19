/**
 * Mobile layout audit. Opens every route at phone and tablet widths and reports
 * horizontal overflow, elements escaping the viewport, elements covered by the
 * fixed tab bar and tap targets that are too small for a finger.
 *
 *   node scripts/qa/mobile-audit.mjs /tmp/mobile-audit
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'ma-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/mobile-audit';
mkdirSync(out, { recursive: true });

const ROUTES = [
  '', 'library', 'prepare', 'export', 'upscale', 'video-upscale', 'bg-remove', 'vector',
  'quality', 'optimize', 'convert', 'generate/eps', 'generate/svg', 'generate/ai', 'generate/jpg',
  'planner', 'plan', 'platforms', 'releases', 'bank', 'earnings', 'subscription', 'cloud',
  'settings', 'admin', 'contact', 'report', 'about',
];

/**
 * Real CSS viewport sizes for the brands the customers actually carry in
 * Bangladesh and India. Vivo/iQOO, Xiaomi (Redmi/POCO), Oppo/realme, Motorola
 * and Huawei/Honor all ship narrower or taller layouts than a Pixel, and each
 * one used to be a blind spot.
 */
const DEVICES = [
  { name: 'vivo-y-series', width: 360, height: 800, dpr: 3 },
  { name: 'iqoo-neo', width: 393, height: 873, dpr: 2.75 },
  { name: 'redmi-note', width: 393, height: 873, dpr: 2 },
  { name: 'poco-x', width: 360, height: 800, dpr: 2.75 },
  { name: 'oppo-a-series', width: 360, height: 780, dpr: 3 },
  { name: 'realme-number', width: 412, height: 915, dpr: 2.625 },
  { name: 'moto-g', width: 412, height: 915, dpr: 2.625 },
  { name: 'huawei-p', width: 393, height: 851, dpr: 2.75 },
  { name: 'honor-x', width: 360, height: 780, dpr: 2 },
  { name: 'galaxy-a', width: 384, height: 854, dpr: 2.8125 },
  { name: 'pixel', width: 360, height: 740, dpr: 3 },
  { name: 'iphone', width: 390, height: 844, dpr: 3 },
  { name: 'iphone-max', width: 430, height: 932, dpr: 3 },
  { name: 'tablet', width: 768, height: 1024, dpr: 2 },
];

const browser = await chromium.launch({
  executablePath: await chromiumBinary.executablePath(),
  args: chromiumBinary.args,
  headless: true,
});

const findings = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.demo.email', 'admin@demo.local');
  localStorage.setItem('msap.launch.done', '1');
  localStorage.setItem('msap.launch.tour', '1');
});
await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' });

for (const device of DEVICES) {
  await page.setViewportSize({ width: device.width, height: device.height });
  for (const route of ROUTES) {
    await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const vw = window.innerWidth;
      const problems = [];
      const main = document.getElementById('workspace-main');
      if (doc.scrollWidth > vw + 1) problems.push(`page scrolls sideways (${doc.scrollWidth}px > ${vw}px)`);
      if (main && main.scrollWidth > main.clientWidth + 1) problems.push(`main scrolls sideways (${main.scrollWidth}px > ${main.clientWidth}px)`);

      const describe = (el) => {
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : '';
        const text = (el.textContent || '').trim().slice(0, 40);
        return `${el.tagName.toLowerCase()}${id}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
      };

      const tabBar = document.querySelector('nav[aria-label="Quick navigation"]');
      const tabTop = tabBar ? tabBar.getBoundingClientRect().top : Infinity;

      const all = Array.from(document.querySelectorAll('main *'));
      let escaped = 0;
      let covered = 0;
      let small = 0;
      for (const el of all) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        // Elements that hang outside the right edge without their own scroll container.
        if (rect.right > vw + 1 && style.position !== 'fixed') {
          let ancestorScrolls = false;
          let node = el.parentElement;
          while (node && node !== document.body) {
            const s = getComputedStyle(node);
            if (s.overflowX !== 'visible') { ancestorScrolls = true; break; }
            node = node.parentElement;
          }
          if (!ancestorScrolls && escaped < 6) problems.push(`escapes right edge: ${describe(el)} (right ${Math.round(rect.right)})`);
          if (!ancestorScrolls) escaped++;
        }
        const interactive = el.closest('button, a, input, select, textarea, [role="button"]');
        // A checkbox or radio inside a label is tapped through that label, so
        // the label's box is the real target, not the 20 px glyph.
        const labellingParent =
          el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')
            ? el.closest('label')
            : null;
        const targetRect = labellingParent ? labellingParent.getBoundingClientRect() : rect;
        if (
          interactive === el &&
          (targetRect.height < 32 || targetRect.width < 32) &&
          style.display !== 'inline'
        ) {
          if (small < 5) problems.push(`small tap target: ${describe(el)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
          small++;
        }
      }
      // After scrolling to the very bottom, nothing may stay hidden behind the tab bar.
      if (main && tabBar) {
        const restore = main.scrollTop;
        main.scrollTop = main.scrollHeight;
        const last = document.querySelector('main [data-last-block]') ?? null;
        void last;
        const blocks = Array.from(main.querySelectorAll(':scope > div > *'));
        const final = blocks[blocks.length - 1];
        if (final) {
          const rect = final.getBoundingClientRect();
          if (rect.bottom > tabBar.getBoundingClientRect().top + 2) {
            problems.push(`last block cannot clear the tab bar: ${describe(final)} (bottom ${Math.round(rect.bottom)}, bar ${Math.round(tabBar.getBoundingClientRect().top)})`);
          }
        }
        main.scrollTop = restore;
      }
      return { problems, overflow: escaped, small, covered };
    });
    if (report.problems.length) {
      findings.push({ device: device.name, route: route || '(home)', problems: report.problems });
    }
    await page.screenshot({ path: path.join(out, `${device.name}-${(route || 'home').replace(/\//g, '-')}.png`), fullPage: false });
  }
}
await browser.close();

let total = 0;
for (const entry of findings) {
  total += entry.problems.length;
  console.log(`\n${entry.device} / ${entry.route}`);
  for (const problem of entry.problems) console.log(`  - ${problem}`);
}
console.log(`\n${findings.length} screens with problems, ${total} findings`);

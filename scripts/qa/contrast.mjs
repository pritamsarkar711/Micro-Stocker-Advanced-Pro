/**
 * Contrast audit for every route in both themes.
 *
 * Walks real text nodes, resolves the effective (composited) background, and
 * reports anything below WCAG AA. Output is grouped so a token fix can be
 * verified path by path.
 *
 *   node scripts/qa/contrast.mjs [--theme dark|light] [--routes a,b]
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'contrast-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;

const args = process.argv.slice(2);
const themeArg = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : null;
const routesArg = args.includes('--routes') ? args[args.indexOf('--routes') + 1] : null;

const ROUTES = routesArg
  ? routesArg.split(',')
  : ['', 'library', 'prepare', 'export', 'vector', 'quality', 'optimize', 'upscale', 'video-upscale', 'bg-remove', 'convert', 'plan', 'earnings', 'planner', 'platforms', 'releases', 'bank', 'subscription', 'admin', 'cloud', 'settings', 'contact', 'report', 'about'];
const THEMES = themeArg ? [themeArg] : ['light', 'dark'];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args,
  headless: true,
});

const findings = [];

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
    } catch {}
  });
  const page = await ctx.newPage();

  for (const theme of THEMES) {
    for (const route of ROUTES) {
      await page.goto(`http://127.0.0.1:5173/#/${route}`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => {
        localStorage.setItem('msap:data:msap:settings', JSON.stringify({ theme: t }));
        document.documentElement.classList.toggle('dark', t === 'dark');
        document.documentElement.style.colorScheme = t;
      }, theme);
      await page.waitForTimeout(450);

      const rows = await page.evaluate(() => {
        const parse = (value) => {
          const m = String(value).match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
          return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
        };
        const over = (top, bottom) => {
          if (!top) return bottom;
          const a = top.a ?? 1;
          if (!bottom) return { r: top.r, g: top.g, b: top.b, a };
          return {
            r: top.r * a + bottom.r * (1 - a),
            g: top.g * a + bottom.g * (1 - a),
            b: top.b * a + bottom.b * (1 - a),
            a: 1,
          };
        };
        const lum = (c) => {
          const f = (v) => {
            const x = v / 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        };
        const ratio = (a, b) => {
          const la = lum(a);
          const lb = lum(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };
        const bgOf = (el) => {
          let node = el;
          let acc = null;
          while (node && node !== document.documentElement) {
            const style = getComputedStyle(node);
            const paint = parse(style.backgroundColor);
            if (paint && paint.a > 0) {
              acc = over(acc, paint);
              if (acc && acc.a >= 1) return acc;
            }
            node = node.parentElement;
          }
          const rootBg = parse(getComputedStyle(document.body).backgroundColor) ?? parse(getComputedStyle(document.documentElement).backgroundColor);
          return over(acc, rootBg ?? { r: 255, g: 255, b: 255, a: 1 });
        };
        const pathOf = (el) => {
          const bits = [];
          let node = el;
          let depth = 0;
          while (node && node !== document.body && depth < 5) {
            const cls = typeof node.className === 'string' ? node.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
            bits.unshift(`${node.tagName.toLowerCase()}${cls ? '.' + cls : ''}`);
            node = node.parentElement;
            depth += 1;
          }
          return bits.join(' > ');
        };

        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const text = node.textContent?.trim() ?? '';
          const parent = node.parentElement;
          if (text.length > 1 && parent) {
            const style = getComputedStyle(parent);
            const rect = parent.getBoundingClientRect();
            const hidden =
              style.visibility === 'hidden' ||
              style.display === 'none' ||
              Number(style.opacity) < 0.05 ||
              rect.width < 2 ||
              rect.height < 2 ||
              parent.closest('[aria-hidden="true"]') ||
              parent.closest('[disabled]');
            if (!hidden) {
              const fg = parse(style.color);
              if (fg) {
                const bg = bgOf(parent);
                const solidFg = over({ ...fg, a: fg.a }, bg);
                const size = Number.parseFloat(style.fontSize);
                const weight = Number(style.fontWeight) || 400;
                const large = size >= 24 || (size >= 18.66 && weight >= 700);
                const min = large ? 3 : 4.5;
                const r = ratio(solidFg, bg);
                if (r < min) {
                  out.push({
                    path: pathOf(parent),
                    text: text.slice(0, 48),
                    color: style.color,
                    bg: `rgb(${Math.round(bg.r)} ${Math.round(bg.g)} ${Math.round(bg.b)})`,
                    size: Math.round(size * 10) / 10,
                    weight,
                    ratio: Math.round(r * 100) / 100,
                    min,
                  });
                }
              }
            }
          }
          node = walker.nextNode();
        }
        return out;
      });

      findings.push({ theme, route: route || 'overview', rows });
    }
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}

const unique = new Map();
for (const group of findings) {
  for (const row of group.rows) {
    const key = `${group.theme}|${row.path}|${row.color}|${row.bg}`;
    if (!unique.has(key)) unique.set(key, { ...row, theme: group.theme, routes: new Set() });
    unique.get(key).routes.add(group.route);
  }
}

const list = [...unique.values()].sort((a, b) => a.ratio - b.ratio);
for (const row of list) {
  console.log(
    `${row.theme.padEnd(5)} ${String(row.ratio).padStart(5)} <${row.min}  ${row.color} on ${row.bg}  ${row.size}px/${row.weight}  "${row.text}"\n      ${row.path}  [${[...row.routes].slice(0, 4).join(', ')}]`,
  );
}
console.log(`\n${list.length} contrast problems (${findings.reduce((n, g) => n + g.rows.length, 0)} occurrences)`);

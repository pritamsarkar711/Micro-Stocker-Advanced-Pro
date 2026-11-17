/**
 * Deep interface audit: every route at ten widths.
 *
 * Checks horizontal overflow, clipped text, hidden overflow, overlapping
 * controls, undersized tap targets, sub-11px type, placeholder leaks
 * ("undefined", "NaN", "[object Object]") and console errors.
 *
 *   node scripts/qa/deep-audit.mjs            (expects the dev server on 5173)
 *   node scripts/qa/deep-audit.mjs --shots    (also writes /tmp/shots/deep-*)
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'deep-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;
mkdirSync('/tmp/shots', { recursive: true });

const shots = process.argv.includes('--shots');
const only = process.env.ROUTES ? process.env.ROUTES.split(',') : null;
const routes = only ?? ['', 'library', 'prepare', 'export', 'vector', 'quality', 'optimize', 'upscale', 'video-upscale', 'bg-remove', 'convert', 'planner', 'plan', 'platforms', 'releases', 'bank', 'cloud', 'subscription', 'admin', 'settings', 'contact', 'report', 'about', 'earnings'];
const widths = (process.env.WIDTHS ?? '320,375,414,768,900,1024,1280,1440,1680,1920').split(',').map(Number);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001'); } catch {} });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
page.on('pageerror', (e) => errs.push(`PAGE ${e.message.slice(0, 120)}`));

const audit = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = { overflow: document.documentElement.scrollWidth - vw, offenders: [], clipped: [], overlap: [], small: [], tiny: [], leaks: [], hidden: [] };
  const name = (el) => {
    const cls = String(el.className?.baseVal ?? el.className ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
  };
  /** Visible and not scrolled/clipped out of sight by a container or a fixed bar. */
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const pcs = getComputedStyle(node);
      if (pcs.position === 'fixed') return false;
      if (/(hidden|auto|scroll)/.test(pcs.overflowX + pcs.overflowY)) {
        const pr = node.getBoundingClientRect();
        if (r.right < pr.left + 2 || r.left > pr.right - 2 || r.bottom < pr.top + 2 || r.top > pr.bottom - 2) return false;
      }
    }
    return true;
  };

  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.position === 'fixed') continue;

    // 1. Runs past the viewport
    if (r.right > vw + 2 || r.left < -2) out.offenders.push(`${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);

    // 2. Text is clipped with no way to read it
    const clippedText = (cs.overflowX === 'hidden' || cs.overflow === 'hidden') && el.scrollWidth > el.clientWidth + 2 && (el.textContent ?? '').trim().length > 0;
    if (clippedText && cs.textOverflow !== 'ellipsis') out.clipped.push(`${name(el)} ${el.clientWidth}/${el.scrollWidth}`);

    // 3. Content pushed out of a fixed-height box
    if ((cs.overflowY === 'hidden' || cs.overflow === 'hidden') && el.scrollHeight > el.clientHeight + 3 && (el.textContent ?? '').trim().length > 0 && cs.maxHeight !== 'none') {
      out.hidden.push(`${name(el)} ${el.clientHeight}/${el.scrollHeight}`);
    }

    // 4. Sub-11px type
    const fs = parseFloat(cs.fontSize);
    // Decorative monograms (brand tiles) are iconography, not readable copy.
    const decorative = el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]');
    if (fs && fs < 11 && (el.textContent ?? '').trim().length > 1 && el.children.length === 0 && !decorative) out.tiny.push(`${name(el)} ${fs}px`);

    // 5. Leaked values
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ');
    if (/\b(undefined|NaN|\[object Object\]|Invalid Date)\b/.test(own)) out.leaks.push(`${name(el)}`);
  }

  // 6. Overlapping interactive controls (inputs and the buttons inside their shell are expected)
  const controls = Array.from(document.querySelectorAll('button, a[href], select, textarea'))
    .filter(visible)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.top < vh && r.bottom > 0);
  for (let i = 0; i < controls.length; i += 1) {
    for (let j = i + 1; j < controls.length; j += 1) {
      const a = controls[i].r;
      const b = controls[j].r;
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 6 && y > 6) {
        const area = x * y;
        const smaller = Math.min(a.width * a.height, b.width * b.height);
        if (smaller > 0 && area / smaller > 0.45) out.overlap.push(`${name(controls[i].el)} <> ${name(controls[j].el)}`);
      }
    }
  }

  // 7. Undersized tap targets on touch widths
  if (vw <= 768) {
    for (const el of Array.from(document.querySelectorAll('button, a[href]'))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if ((r.width < 24 || r.height < 24) && r.width > 0) out.small.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }

  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) out[key] = Array.from(new Set(out[key])).slice(0, 6);
  }
  return out;
};

const rows = [];
for (const w of widths) {
  await page.setViewportSize({ width: w, height: w < 700 ? 780 : 900 });
  for (const r of routes) {
    errs.length = 0;
    await page.goto(`http://127.0.0.1:5173/#/${r}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(520);
    const res = await page.evaluate(audit);
    const bad = res.overflow > 1 || res.clipped.length || res.overlap.length || res.small.length || res.tiny.length || res.leaks.length || res.hidden.length || errs.length;
    if (bad) rows.push({ route: r || 'overview', width: w, ...res, errors: [...errs] });
    if (bad) {
      const bits = [];
      if (res.overflow > 1) bits.push(`overflow ${res.overflow}px: ${res.offenders.slice(0, 2).join(' | ')}`);
      if (res.clipped.length) bits.push(`clipped: ${res.clipped.slice(0, 2).join(' | ')}`);
      if (res.hidden.length) bits.push(`cut: ${res.hidden.slice(0, 2).join(' | ')}`);
      if (res.overlap.length) bits.push(`overlap: ${res.overlap.slice(0, 2).join(' | ')}`);
      if (res.small.length) bits.push(`tap: ${res.small.slice(0, 2).join(' | ')}`);
      if (res.tiny.length) bits.push(`tiny: ${res.tiny.slice(0, 2).join(' | ')}`);
      if (res.leaks.length) bits.push(`leak: ${res.leaks.slice(0, 2).join(' | ')}`);
      if (errs.length) bits.push(`console: ${errs.slice(0, 1).join(' | ')}`);
      console.log(`${String(w).padStart(4)} ${(r || 'overview').padEnd(14)} ${bits.join(' || ')}`);
    }
  }
}

if (shots) {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const r of routes) {
    await page.goto(`http://127.0.0.1:5173/#/${r}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `/tmp/shots/deep-${r || 'overview'}.png`, fullPage: true });
  }
}

console.log(`\nFAILING VIEWS: ${rows.length}`);
await browser.close();
rmSync(scratch, { recursive: true, force: true });
process.exit(rows.length ? 1 : 0);

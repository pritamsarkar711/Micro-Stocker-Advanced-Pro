/**
 * Vector Studio regression walk: draw, reshape, rotate, type, insert, align,
 * undo/redo, import, and every export path.
 *
 *   node scripts/qa/vector-check.mjs
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'vector-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;

mkdirSync('/tmp/shots', { recursive: true });
const errors = [];
const checks = [];
const ok = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args,
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, acceptDownloads: true });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.addInitScript(() => {
  if (!sessionStorage.getItem('msap.test.ready')) {
    localStorage.clear();
    sessionStorage.setItem('msap.test.ready', '1');
  }
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
});

const frameSel = '[data-testid="vector-frame"]';
const children = () => page.evaluate(() => Array.from(document.querySelector('[data-testid="vector-frame"] svg').children).map((c) => c.tagName.toLowerCase()));
const docState = () =>
  page.evaluate(() => {
    const svg = document.querySelector('[data-testid="vector-frame"] svg');
    return {
      viewBox: svg.getAttribute('viewBox'),
      objects: Array.from(svg.children).filter((c) => c.id !== 'background').length,
      serialized: new XMLSerializer().serializeToString(svg),
    };
  });

await page.goto('http://127.0.0.1:5173/#/vector', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shots/vector-01-empty.png' });

/* 1 — draw a rectangle */
await page.getByRole('button', { name: 'Rectangle', exact: true }).first().click();
let box = await page.locator(frameSel).boundingBox();
await page.mouse.move(box.x + 120, box.y + 120);
await page.mouse.down();
await page.mouse.move(box.x + 380, box.y + 320, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(350);
let tags = await children();
ok('draw rect', tags.filter((tag) => tag === 'rect').length === 1, tags.join(','));

/* 2 — resize via the south-east handle */
const beforeResize = await page.evaluate(() => document.querySelector('[data-testid="vector-frame"] svg rect').getAttribute('width'));
const se = await page.locator(`${frameSel} [data-handle="se"]`).boundingBox();
await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
await page.mouse.down();
await page.mouse.move(se.x + 60, se.y + 40, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(250);
const afterResize = await page.evaluate(() => document.querySelector('[data-testid="vector-frame"] svg rect').getAttribute('transform') ?? '');
ok('resize handle', afterResize.includes('scale'), afterResize.slice(0, 60));

/* 3 — rotation slider */
await page.locator('input[aria-label="Rotation"]').fill('45');
await page.locator('input[aria-label="Rotation"]').dispatchEvent('pointerup');
await page.locator('input[aria-label="Rotation"]').dispatchEvent('change');
await page.waitForTimeout(250);
const rotated = await page.evaluate(() => document.querySelector('[data-testid="vector-frame"] svg rect').getAttribute('transform') ?? '');
ok('rotate', rotated.includes('rotate'), rotated.slice(0, 70));

/* 4 — undo restores the pre-rotation transform */
await page.keyboard.press('Control+z');
await page.waitForTimeout(250);
const undone = await page.evaluate(() => document.querySelector('[data-testid="vector-frame"] svg rect')?.getAttribute('transform') ?? 'missing');
ok('undo', undone !== rotated, undone.slice(0, 50));
await page.keyboard.press('Control+Shift+z');
await page.waitForTimeout(250);
const redone = await page.evaluate(() => document.querySelector('[data-testid="vector-frame"] svg rect')?.getAttribute('transform') ?? '');
ok('redo', redone.includes('rotate'), redone.slice(0, 50));

/* 5 — text tool */
await page.getByRole('button', { name: 'Text', exact: true }).first().click();
box = await page.locator(frameSel).boundingBox();
await page.mouse.click(box.x + 520, box.y + 460);
await page.waitForTimeout(350);
await page.locator('textarea[aria-label="Text content"]').fill('Editable type');
await page.locator('textarea[aria-label="Text content"]').blur();
await page.waitForTimeout(250);
const textContent = await page.evaluate(() => document.querySelector('[data-testid="vector-frame"] svg text')?.textContent ?? '');
ok('text tool', textContent === 'Editable type', textContent);

/* 6 — element library inserts two shapes */
await page.getByRole('button', { name: 'Elements', exact: true }).click();
await page.getByLabel('Search library').fill('star');
await page.waitForTimeout(200);
await page.getByTestId('elements-panel').getByRole('button', { name: 'Star', exact: true }).first().click();
await page.waitForTimeout(250);
await page.getByTestId('elements-panel').getByRole('button', { name: 'Six point star', exact: true }).first().click();
await page.waitForTimeout(250);
await page.getByLabel('Search library').fill('');
const groups = (await children()).filter((tag) => tag === 'g').length;
ok('element library', groups === 2, `groups=${groups}`);

/* 7 — marquee select both groups, then align left */
await page.getByRole('button', { name: 'Design', exact: true }).click();
box = await page.locator(frameSel).boundingBox();
await page.mouse.move(box.x + 8, box.y + 8);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(300);
const badge = await page.locator(`${frameSel} span`, { hasText: 'selected' }).first().textContent().catch(() => '');
ok('marquee multi-select', /selected/.test(badge ?? ''), badge ?? '');
await page.screenshot({ path: '/tmp/shots/vector-03-selection.png' });

/* 8 — export SVG, PNG and EPS */
for (const [label, name] of [
  [/^SVG/, 'svg'],
  [/^PNG 2×/, 'png'],
  [/^EPS/, 'eps'],
]) {
  const pending = page.waitForEvent('download', { timeout: 12000 }).catch(() => null);
  await page.getByRole('button', { name: /Export/ }).click();
  await page.waitForTimeout(180);
  await page.getByRole('button', { name: label }).click();
  const download = await pending;
  ok(`export ${name}`, Boolean(download), download ? download.suggestedFilename() : 'no download');
  await page.waitForTimeout(300);
}

/* 9 — import a real SVG as the document */
const imported = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="#0f766e"/><rect x="60" y="60" width="80" height="80" fill="#fce8f0"/></svg>';
await page.setInputFiles('input[type="file"]', { name: 'imported.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(imported) });
await page.waitForTimeout(800);
let state = await docState();
ok('import svg', state.viewBox === '0 0 200 200' && state.objects === 2, `${state.viewBox} / ${state.objects}`);
await page.screenshot({ path: '/tmp/shots/vector-04-imported.png' });

/* 10 — live preview is rendering the document */
const preview = await page.evaluate(() => {
  const img = document.querySelector('img[alt="Live artwork preview"]');
  return img ? { src: img.getAttribute('src')?.slice(0, 24), w: img.naturalWidth, h: img.naturalHeight } : null;
});
ok('live preview', preview && (preview.w > 0 || preview.src?.startsWith('data:image/svg')), JSON.stringify(preview));

/* 11 — present mode */
await page.getByRole('button', { name: 'Present' }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/shots/vector-05-present.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
ok('present closes', (await page.locator('[role="dialog"]').count()) === 0);

/* 12 — reload restores the autosaved document */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
state = await docState();
ok('autosave restore', state.viewBox === '0 0 200 200', state.viewBox ?? '');
await page.screenshot({ path: '/tmp/shots/vector-06-restored.png' });

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({ checks, failed: failed.length, errors }, null, 1));
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);

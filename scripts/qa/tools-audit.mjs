/**
 * End to end check of every studio tool.
 *
 * Each tool gets a real fixture, the primary action is pressed, and the script
 * waits for an output the user could actually download. Console errors and
 * unhandled rejections are collected for the whole run. This is the gate that
 * catches "the button does nothing" regressions that a layout audit cannot see.
 *
 *   node scripts/qa/tools-audit.mjs
 *   node scripts/qa/tools-audit.mjs --shots    (writes screenshots to /tmp/shots)
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const shots = process.argv.includes('--shots');

const scratch = mkdtempSync(path.join(tmpdir(), 'tools-audit-'));
writeFileSync(
  path.join(scratch, 'libs.tar'),
  brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')),
);
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

function makePhoto(size = 1200, quality = 88) {
  const canvas = createCanvas(size, Math.round(size * 0.75));
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6);
  sky.addColorStop(0, '#6fa8d6');
  sky.addColorStop(1, '#cfe4f2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6);
  ctx.fillStyle = '#4f7a44';
  ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height);
  for (let i = 0; i < 320; i += 1) {
    const x = Math.random() * canvas.width;
    const y = canvas.height * 0.62 + Math.random() * canvas.height * 0.34;
    const r = 4 + Math.random() * 14;
    ctx.fillStyle = `hsl(${86 + Math.random() * 40} ${28 + Math.random() * 30}% ${22 + Math.random() * 26}%)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toBuffer('image/jpeg', quality);
}

function makeCutout() {
  const canvas = createCanvas(700, 700);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 700, 700);
  const gradient = ctx.createRadialGradient(350, 330, 40, 350, 350, 280);
  gradient.addColorStop(0, '#f0b8c4');
  gradient.addColorStop(1, '#c2185b');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(350, 350, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a1746';
  ctx.fillRect(230, 300, 240, 40);
  return canvas.toBuffer('image/png');
}

const photoPath = path.join(scratch, 'landscape.jpg');
const cutoutPath = path.join(scratch, 'cutout.png');
// A maximum quality JPEG gives the optimizer real headroom to work with.
const compressiblePhotoPath = path.join(scratch, 'compressible.jpg');
writeFileSync(photoPath, makePhoto());
writeFileSync(compressiblePhotoPath, makePhoto(1600, 100));
writeFileSync(cutoutPath, makeCutout());

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const browser = await chromium.launch({
  executablePath: await chromiumBinary.executablePath(),
  args: chromiumBinary.args,
  headless: true,
});

const problems = [];
const results = [];

// One page for the whole run: a 16 MP upscale leaves large canvases behind and
// closing that page in single process Chromium tears the browser down.
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text().slice(0, 200));
});
page.on('pageerror', (error) => errors.push(`unhandled: ${error.message.slice(0, 200)}`));
await page.addInitScript(() => {
  try {
    localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
  } catch {
    /* about:blank has an opaque origin and no storage */
  }
});

async function withPage(fn) {
  errors = [];
  try {
    await fn(page, errors);
  } catch (error) {
    record(`step crashed at ${new URL(page.url()).hash}`, false, String(error).split('\n')[0].slice(0, 90));
  } finally {
    if (errors.length) problems.push(...errors.map((error) => `${page.url()} :: ${error}`));
  }
}

/** Full remount, so a tool never inherits queue state from the one before it. */
async function openTool(route) {
  await page.goto('about:blank');
  await page.goto(`${base}/#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}

// Upscaler: built in Lanczos must produce a larger image.
await withPage(async (page) => {
  await openTool('upscale');
  await page.locator('input[type=file]').first().setInputFiles(photoPath);
  await page.waitForTimeout(1500);
  const suggestion = await page.locator('text=Suggested for this image').count();
  record('upscale suggestion appears', suggestion > 0);
  const run = page.getByRole('button', { name: /^Upscale/ }).first();
  await run.click();
  // The queue row only grows a Save button once a real output exists.
  const done = await page
    .locator('button:has-text("Save")')
    .first()
    .waitFor({ timeout: 150_000 })
    .then(() => true)
    .catch(() => false);
  const body = await page.locator('body').innerText();
  const failed = /Failed|Error/i.test(body);
  record('upscale produces output', done && !failed, failed ? 'error state' : done ? 'result row' : 'timeout');
  if (shots) await page.screenshot({ path: '/tmp/shots/tool-upscale.png', fullPage: true });
});

// Background remover.
await withPage(async (page) => {
  await openTool('bg-remove');
  await page.locator('input[type=file]').first().setInputFiles(cutoutPath);
  await page.waitForTimeout(1500);
  const action = page.getByRole('button', { name: /Remove background/i }).first();
  if (await action.count()) {
    await action.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null);
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')].find((el) =>
        /Remove background/i.test(el.textContent || ''),
      );
      return Boolean(button && !button.disabled);
    }, null, { timeout: 20_000 }).catch(() => null);
    await action.click({ timeout: 15_000 });
    const done = await page
      .locator('button:has-text("Save")')
      .first()
      .waitFor({ timeout: 90_000 })
      .then(() => true)
      .catch(() => false);
    record('background remover produces output', done, done ? 'cutout ready' : 'timeout');
  } else {
    record('background remover has a primary action', false, 'button missing');
  }
  if (shots) await page.screenshot({ path: '/tmp/shots/tool-bgremove.png', fullPage: true });
});

// Optimizer.
await withPage(async (page) => {
  await openTool('optimize');
  await page.locator('input[type=file]').first().setInputFiles(compressiblePhotoPath);
  await page.waitForTimeout(1500);
  const suggest = await page.locator('text=Suggested').count();
  record('optimizer suggests a format', suggest > 0);
  const run = page.getByRole('button', { name: /^Optimize/ }).first();
  await run.click();
  // The header summary renders immediately with zeros, so wait for a finished
  // queue row instead of any Download button.
  const finished = await page
    .waitForFunction(
      () => {
        const text = document.body.innerText;
        return /\d+% smaller/.test(text) && !/Optimizing…/.test(text);
      },
      null,
      { timeout: 120_000 },
    )
    .then(() => true)
    .catch(() => false);
  const body = await page.locator('body').innerText();
  record(
    'optimizer produces a smaller file',
    finished && /\d+% smaller/.test(body) && !/needs the canvas pipeline|Failed|could not/i.test(body),
    body.match(/\d+% smaller/)?.[0] ?? 'no result',
  );
  if (shots) await page.screenshot({ path: '/tmp/shots/tool-optimize.png', fullPage: true });
});

// Converter.
await withPage(async (page) => {
  await openTool('convert');
  await page.locator('input[type=file]').first().setInputFiles(photoPath);
  await page.waitForTimeout(1200);
  const run = page.getByRole('button', { name: /^Convert to/ }).first();
  await run.click();
  const done = await page
    .getByRole('button', { name: /^Download/ })
    .first()
    .waitFor({ timeout: 120_000 })
    .then(() => true)
    .catch(() => false);
  const body = await page.locator('body').innerText();
  record('converter produces output', done && !/failed|could not|unsupported/i.test(body), done ? 'result' : 'timeout');
  if (shots) await page.screenshot({ path: '/tmp/shots/tool-convert.png', fullPage: true });
});

// Quality checker.
await withPage(async (page) => {
  await openTool('quality');
  await page.locator('input[type=file]').first().setInputFiles(photoPath);
  await page.waitForTimeout(2500);
  const body = await page.locator('body').innerText();
  record('quality report renders a verdict', /At risk|Ready to submit|Needs work|\d+ findings/i.test(body), '');
  const row = page.locator('button[aria-expanded]').first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(900);
    const expanded = await page.locator('body').innerText();
    record('quality report opens its findings', /Sharpness|Resolution|focus|Noise/i.test(expanded), '');
  } else {
    record('quality report opens its findings', false, 'no expandable row');
  }
  if (shots) await page.screenshot({ path: '/tmp/shots/tool-quality.png', fullPage: true });
});

// Library import plus offline AI metadata.
await withPage(async (page) => {
  await openTool('library');
  const fileInput = page.locator('input[type=file]').first();
  await fileInput.setInputFiles([photoPath, cutoutPath]);
  await page.waitForTimeout(2500);
  const cards = await page.locator('button[aria-label^="Select "]').count();
  const named = (await page.locator('body').innerText()).includes('landscape.jpg');
  const thumbs = await page.locator('img[alt="landscape.jpg"]').count();
  record('library imports files', cards >= 2 && named && thumbs > 0, `${cards} rows`);
  const aiDraft = page.getByRole('button', { name: /AI draft|Generate metadata|Auto tag/i }).first();
  if (await aiDraft.count()) {
    await aiDraft.click();
    await page.waitForTimeout(4000);
    const title = await page.locator('input[value*="landscape"], textarea').first().inputValue().catch(() => '');
    record('offline AI drafts metadata', Boolean(title), title.slice(0, 48));
    if (shots) await page.screenshot({ path: '/tmp/shots/tool-library-ai.png', fullPage: true });
  } else {
    record('library exposes an AI draft action', false, 'button missing');
  }
});

await browser.close();

const failed = results.filter((result) => !result.ok);
console.log(`\nTOOLS: ${results.length - failed.length}/${results.length} passed`);
if (problems.length) {
  console.log(`CONSOLE PROBLEMS: ${problems.length}`);
  for (const problem of problems.slice(0, 12)) console.log(`  * ${problem}`);
}
console.log(`\nPROBLEMS: ${failed.length + problems.length}`);
process.exit(failed.length + problems.length > 0 ? 1 : 0);

/**
 * Interaction audit: menus, dropdowns and dialogs that only exist after a click.
 *
 * Each opening is checked for horizontal overflow and console errors at desktop
 * and phone widths, and screenshots are written to /tmp/shots when --shots is
 * passed.
 *
 *   node scripts/qa/interaction-audit.mjs [--shots]
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'interaction-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;
mkdirSync('/tmp/shots', { recursive: true });
const shots = process.argv.includes('--shots');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()), args: chromiumBinary.args, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await context.addInitScript(() => { localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001'); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

const problems = [];
const base = 'http://127.0.0.1:5173/#/';

async function visit(route, width) {
  await page.setViewportSize({ width, height: width < 700 ? 800 : 950 });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
}

async function evaluateCase(label, open) {
  errors.length = 0;
  try {
    const opened = await open();
    if (opened === false) {
      problems.push(`${label}: control not found`);
      return;
    }
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      dialogs: document.querySelectorAll('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]').length,
    }));
    if (state.overflow > 1) problems.push(`${label}: overflows by ${state.overflow}px`);
    if (errors.length) problems.push(`${label}: ${errors[0].slice(0, 90)}`);
    if (shots) await page.screenshot({ path: `/tmp/shots/ix-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
  } catch (error) {
    problems.push(`${label}: ${String(error.message).slice(0, 120)}`);
  } finally {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }
}

for (const width of [1440, 375]) {
  const suffix = width < 700 ? 'phone' : 'desktop';

  await visit('vector', width);
  await evaluateCase(`vector new menu ${suffix}`, async () => {
    const button = page.getByRole('button', { name: /^New/ }).first();
    if (!(await button.count())) return false;
    await button.click();
    return true;
  });
  await evaluateCase(`vector export menu ${suffix}`, async () => {
    const button = page.getByRole('button', { name: /Export/ }).first();
    if (!(await button.count())) return false;
    await button.click();
    return true;
  });

  await visit('library', width);
  await evaluateCase(`library account menu ${suffix}`, async () => {
    const button = page.locator('button[aria-haspopup="dialog"]').first();
    if (!(await button.count())) return false;
    await button.click();
    return true;
  });

  await visit('platforms', width);
  await evaluateCase(`platform rules expand ${suffix}`, async () => {
    const button = page.getByRole('button', { name: /Rules and formats/ }).first();
    if (!(await button.count())) return false;
    await button.click();
    return true;
  });

  await visit('settings', width);
  await evaluateCase(`settings security open ${suffix}`, async () => {
    const button = page.getByRole('button', { name: 'Enable', exact: true }).first();
    if (!(await button.count())) return false;
    await button.click();
    return true;
  });
}

await browser.close();
console.log(problems.length ? problems.join('\n') : 'interaction audit clean');
console.log(`\nPROBLEMS: ${problems.length}`);
process.exit(problems.length ? 1 : 0);

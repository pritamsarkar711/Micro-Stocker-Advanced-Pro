/**
 * Auto-suggestion walkthrough: upscaler model/target and optimizer format are
 * chosen from the actual file, and the reason is visible to the user.
 *
 *   node scripts/qa/suggest-check.mjs
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'suggest-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH || ''}`;
mkdirSync('/tmp/shots', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
});

/** Paint a PNG (optionally with real transparency) or JPEG in the page. */
async function makeFile(kind) {
  const base64 = await page.evaluate(async (type) => {
    const canvas = document.createElement('canvas');
    canvas.width = type === 'photo' ? 2600 : 900;
    canvas.height = type === 'photo' ? 1733 : 900;
    const ctx = canvas.getContext('2d');
    if (type === 'cutout') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#a3124c';
      ctx.beginPath();
      ctx.arc(450, 450, 320, 0, Math.PI * 2);
      ctx.fill();
      ctx.clearRect(380, 340, 130, 130);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1b2330');
      gradient.addColorStop(0.55, '#7b1a45');
      gradient.addColorStop(1, '#f7a1bd');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 500; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3, 3);
      }
    }
    const mime = type === 'cutout' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));
    const buffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
    }
    return btoa(binary);
  }, kind);
  return Buffer.from(base64, 'base64');
}

const checks = [];
const ok = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });

// --- Upscaler: transparent cutout -----------------------------------------
await page.goto('http://127.0.0.1:5173/#/upscale', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
let input = page.locator('input[type=file]');
await input.setInputFiles({ name: 'cutout.png', mimeType: 'image/png', buffer: await makeFile('cutout') });
await page.waitForTimeout(1400);
const suggested = page.getByText('Suggested for this image');
ok('upscaler shows a suggestion', (await suggested.count()) > 0);
const cutoutText = (await page.locator('body').innerText()).slice(0, 4000);
ok('cutout picks Edge Guided Sharp', cutoutText.includes('Edge Guided Sharp'));
ok('cutout target is a stock preset', /Shutterstock|Adobe|Getty|Alamy|123RF|Dreamstime/.test(cutoutText));
await page.screenshot({ path: '/tmp/shots/suggest-upscale-cutout.png', fullPage: true });

// --- Upscaler: large photo -------------------------------------------------
await page.goto('http://127.0.0.1:5173/#/upscale', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
input = page.locator('input[type=file]');
await input.setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: await makeFile('photo') });
await page.waitForTimeout(1600);
const photoText = await page.locator('body').innerText();
ok('photo suggestion rendered', photoText.includes('Suggested for this image'));
ok('photo recommends a ready model', /Lanczos Pro|Edge Guided|Denoise/.test(photoText));
await page.screenshot({ path: '/tmp/shots/suggest-upscale-photo.png', fullPage: true });

// --- Optimizer: transparency ----------------------------------------------
await page.goto('http://127.0.0.1:5173/#/optimize', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
input = page.locator('input[type=file]');
await input.setInputFiles({ name: 'cutout.png', mimeType: 'image/png', buffer: await makeFile('cutout') });
await page.waitForTimeout(1600);
const optimizeText = await page.locator('body').innerText();
ok('optimizer explains the format', optimizeText.includes('Transparency detected') || optimizeText.includes('Transparent PNG stays PNG'));
const selectValue = await page.locator('select').first().inputValue();
ok('optimizer keeps an alpha safe format', selectValue === 'webp' || selectValue === 'png', selectValue);
await page.screenshot({ path: '/tmp/shots/suggest-optimize.png', fullPage: true });

ok('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
console.log(JSON.stringify({ checks, failed: checks.filter((check) => !check.pass).length }, null, 1));
process.exit(checks.some((check) => !check.pass) ? 1 : 0);

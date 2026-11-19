/**
 * End-to-end proof that the phone upscaler works without a desktop:
 * install the mobile ONNX model into browser storage, then upscale a real image
 * through ONNX Runtime WebAssembly.
 *
 * The weights are 4.6 MB and live on GitHub, so the request is intercepted and
 * answered with a tiny stand-in graph that has the same input/output contract
 * (NCHW float32 in, 4x NCHW float32 out). Everything else — the install path,
 * the vault, the tiling, the encoder — is the shipping code.
 *
 *   node scripts/qa/onnx-upscale.mjs /tmp/onnx-upscale
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync, deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const scratch = mkdtempSync(path.join(tmpdir(), 'ox-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/onnx-upscale';
mkdirSync(out, { recursive: true });

/* A real PNG so the app decodes it with the same path a user photo takes. */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
let seed = 1234567;
function noise() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed % 1000) / 1000;
}
function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x += 1) {
      const grain = noise() * 70 - 35;
      raw[offset++] = Math.max(0, Math.min(255, Math.round((x / width) * 180 + grain + 40)));
      raw[offset++] = Math.max(0, Math.min(255, Math.round((y / height) * 150 + grain + 50)));
      raw[offset++] = Math.max(0, Math.min(255, Math.round(((x + y) / (width + height)) * 120 + grain + 60)));
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function checker(x, y) {
  return (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
}

const photo = makePng(400, 300);
const modelBytes = readFileSync('/tmp/test4x.onnx');
console.log(`stand-in graph ${modelBytes.length} B, test photo ${photo.length} B (sha ${createHash('sha256').update(photo).digest('hex').slice(0, 8)})`);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
// The sandbox has no route to api.github.com, so the release check fails here.
// That is an environment limit, not an app error, and it is excluded below.
const environmentNoise = /ERR_CERT_AUTHORITY_INVALID|api\.github\.com/i;
page.on('console', (message) => {
  if (message.type() === 'error') {
    if (environmentNoise.test(message.text())) return;
    errors.push(message.text().slice(0, 200));
    console.log('  console:', message.text().slice(0, 200));
  }
});
page.on('console', (message) => {
  if (message.text().startsWith('[onnx]')) console.log('  ' + message.text().slice(0, 200));
});
page.on('requestfailed', (request) => {
  if (environmentNoise.test(request.url()) || environmentNoise.test(request.failure()?.errorText ?? '')) return;
  console.log('  request failed:', request.url().slice(0, 120), request.failure()?.errorText);
});
page.on('response', (response) => {
  if (response.status() >= 400) console.log(`  http ${response.status()}:`, response.url().slice(0, 140));
});

await page.route('**/*.onnx', (route) =>
  route.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: modelBytes }),
);

await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.demo.email', 'admin@demo.local');
  localStorage.setItem('msap.launch.done', '1');
  localStorage.setItem('msap.launch.tour', '1');
});

await page.goto('http://127.0.0.1:5173/#/upscale', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const tile = page.locator('div', { hasText: 'Real-ESRGAN Mobile x4' }).last();
await page.getByText('Real-ESRGAN Mobile x4').first().waitFor({ timeout: 10_000 }).catch(() => {});
check('the mobile neural model is offered on a phone', (await page.getByText('Real-ESRGAN Mobile x4').count()) > 0);
check('it is not labelled desktop only', (await page.getByText('Desktop', { exact: true }).count()) === 0);

await page.getByRole('button', { name: /Install/ }).first().click();
await page.getByText('Installed', { exact: true }).first().waitFor({ timeout: 30_000 });
check('install finishes and the tile shows Installed', true);
await page.screenshot({ path: path.join(out, '01-installed.png') });

await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: photo });
await page.waitForTimeout(800);
check('the photo is queued', (await page.getByText('sample.png').count()) > 0);
// The installed neural model is the recommended pick for a photo, so the app
// should not have fallen back to a plain resampler.
const tileSelected = await page
  .locator('div.group.relative', { hasText: 'Real-ESRGAN Mobile x4' })
  .first()
  .evaluate((el) => el.className.includes('border-accent'))
  .catch(() => false);
check('the installed neural model is preselected', tileSelected);

const runButton = page.locator('main').getByRole('button', { name: /^Upscale \(/ });
check('the run button is enabled once a photo is queued', await runButton.isEnabled());
await runButton.click();
await page.waitForTimeout(1500);
let finished = false;
for (let attempt = 0; attempt < 90 && !finished; attempt += 1) {
  await page.waitForTimeout(1000);
  finished = (await page.getByRole('button', { name: 'Save' }).count()) > 0;
}
await page.screenshot({ path: path.join(out, '02-upscaled.png') });
check('the neural pass completes without an error', finished);
const failureText = await page.getByText(/failed|could not|error/i).count();
check('no failure message is shown', failureText === 0, `${failureText} matches`);

const preview = await page.evaluate(() => {
  const images = Array.from(document.querySelectorAll('main img'));
  const last = images[images.length - 1];
  return last ? `${last.naturalWidth}x${last.naturalHeight}` : 'none';
});
check('the upscaled pixels are on screen', preview !== 'none' && !preview.startsWith('0x'), preview);
const resultCard = await page.getByText(/4619x3464/).count().catch(() => 0);
check('the queue reports the new pixel size', resultCard > 0, `${resultCard} matches`);

await page.getByText(/Queue \(/).first().scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, '03-queue.png') });

check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

/**
 * Background removal on a phone, end to end.
 *
 * Installs a compact ONNX segmenter through the same vault the app uses, runs it
 * on ONNX Runtime WebAssembly and checks that a cutout comes back. The weights
 * on GitHub are replaced here by a stand-in graph with the same input/output
 * contract (1x3x320x320 in, 1x1x320x320 mask out), so the test needs no network
 * to a release asset while exercising all of the shipping code.
 *
 *   node scripts/qa/onnx-bgremove.mjs /tmp/onnx-bgremove
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync, deflateSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'bg-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/onnx-bgremove';
mkdirSync(out, { recursive: true });

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
      const inside = Math.abs(x - width / 2) + Math.abs(y - height / 2) < Math.min(width, height) / 3;
      raw[offset++] = inside ? 210 : 30;
      raw[offset++] = inside ? 90 : 140;
      raw[offset++] = inside ? 60 : 30;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const photo = makePng(320, 320);
const modelBytes = readFileSync('/tmp/testmask.onnx');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
const environmentNoise = /ERR_CERT_AUTHORITY_INVALID|api\.github\.com/i;
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !environmentNoise.test(message.text())) errors.push(message.text().slice(0, 200));
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

await page.goto('http://127.0.0.1:5173/#/bg-remove', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.getByText('U2Netp Compact').first().waitFor({ timeout: 10_000 }).catch(() => {});
check('a neural cutout model is offered on a phone', (await page.getByText('U2Netp Compact').count()) > 0);

// Select the neural model, then install it.
await page.locator('button', { hasText: 'U2Netp Compact' }).first().click().catch(() => {});
const installButton = page.getByRole('button', { name: /Install/ }).first();
check('the model has an Install button', (await installButton.count()) > 0);
await installButton.click();
await page.getByText('Installed', { exact: true }).first().waitFor({ timeout: 30_000 });
check('install finishes on the phone path', true);
await page.screenshot({ path: path.join(out, '01-installed.png') });

await page.locator('input[type=file]').first().setInputFiles({ name: 'subject.png', mimeType: 'image/png', buffer: photo });
await page.waitForTimeout(800);
check('the photo is queued', (await page.getByText('subject.png').count()) > 0);

const runButton = page.locator('main').getByRole('button', { name: /^Remove background/ }).first();
check('the run button is enabled', await runButton.isEnabled());
await runButton.click();

let finished = false;
for (let attempt = 0; attempt < 60 && !finished; attempt += 1) {
  await page.waitForTimeout(1000);
  finished = (await page.getByRole('button', { name: /Save|Download/ }).count()) > 0;
}
await page.screenshot({ path: path.join(out, '02-cutout.png') });
check('background removal completes', finished);
check('no failure message is shown', (await page.getByText(/failed|could not/i).count()) === 0);
check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

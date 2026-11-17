import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/tests/browser/video.html`);
  await page.getByRole('button', { name: 'Run' }).click();
  await page.waitForFunction(() => document.getElementById('status')?.textContent !== 'Waiting', null, { timeout: 30000 });
  const status = await page.locator('#status').textContent();
  assert.equal(status, 'PASS');
  console.log('Video resize: encoded output retains an audio track');
} finally { await browser.close(); }

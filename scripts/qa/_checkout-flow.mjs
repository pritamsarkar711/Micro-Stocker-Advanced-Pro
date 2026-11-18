// Checkout pass: bKash manual order and a crypto invoice, both in demo mode.
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'checkout-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
const outDir = '/tmp/shots-checkout';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const errors = [];

// The headless build shares one profile, so both flows reuse the same page.
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });

async function signIn(email, label) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });
  await page.goto('http://127.0.0.1:5173/#/subscription', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('body').waitFor();
  try {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().waitFor({ timeout: 12000 });
  } catch (error) {
    await page.screenshot({ path: path.join(outDir, `stuck-${label}.png`), fullPage: true });
    throw error;
  }
  await signInInto(page, email);
  return page;
}

async function signInInto(page, email) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter password').fill('demo-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.waitForTimeout(1400);
}

// 1. Manual mobile money, Standard 6 months.
const mobile = await signIn('carol@demo.local', 'carol');
await mobile.getByRole('button', { name: 'Choose plan' }).nth(1).click();
await mobile.waitForTimeout(400);
await mobile.getByRole('button', { name: /bKash/ }).click();
await mobile.waitForTimeout(200);
await mobile.getByPlaceholder('8N7A2K9XQ1').fill('CAROL9X2Q7');
await mobile.getByPlaceholder('01XXXXXXXXX').fill('01887799071');
await mobile.screenshot({ path: path.join(outDir, 'bkash-form.png'), fullPage: true });
await mobile.getByRole('button', { name: 'Submit payment' }).click();
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: path.join(outDir, 'bkash-placed.png'), fullPage: true });
await mobile.getByRole('button', { name: 'Done' }).click();
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: path.join(outDir, 'bkash-orders.png'), fullPage: true });
const orderText = await mobile.locator('body').innerText();
console.log('manual order listed:', /submitted|pending|awaiting/i.test(orderText), '| trxid shown:', /CAROL9X2Q7/.test(orderText));

// 2. Crypto invoice, Professional 12 months.
await mobile.getByRole('button', { name: /Carol Das/ }).click();
await mobile.waitForTimeout(400);
await mobile.getByRole('button', { name: 'Sign out' }).click();
await mobile.waitForTimeout(1200);
await mobile.close();

const crypt = await context.newPage();
crypt.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
crypt.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });
await crypt.goto('http://127.0.0.1:5173/#/subscription', { waitUntil: 'networkidle' });
await crypt.waitForTimeout(900);
await signInInto(crypt, 'dave@demo.local');
await crypt.getByRole('tab', { name: 'Yearly' }).click();
await crypt.getByRole('button', { name: 'Choose plan' }).nth(2).click();
await crypt.waitForTimeout(400);
await crypt.getByRole('button', { name: /Crypto/ }).click();
await crypt.waitForTimeout(300);
await crypt.screenshot({ path: path.join(outDir, 'crypto-pick.png'), fullPage: true });
await crypt.getByRole('button', { name: 'Create invoice' }).click();
await crypt.waitForTimeout(1500);
await crypt.screenshot({ path: path.join(outDir, 'crypto-invoice.png'), fullPage: true });
const invoiceText = await crypt.locator('body').innerText();
console.log('invoice drawn:', /address|confirmations/i.test(invoiceText));
const check = crypt.getByRole('button', { name: 'Check payment' });
if (await check.count()) {
  await check.click();
  await crypt.waitForTimeout(1200);
  await crypt.screenshot({ path: path.join(outDir, 'crypto-checked.png'), fullPage: true });
}

console.log(errors.length ? `errors: ${errors.slice(0, 6).join(' | ')}` : 'no page errors');
await browser.close();

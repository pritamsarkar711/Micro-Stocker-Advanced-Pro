/**
 * Admin console QA: proves the account controls really do what the buttons say.
 *
 * The dev preview runs on the in-memory demo client, so every click here goes
 * through the same api.ts -> rpc() path the production build uses, including the
 * permission checks (self lockout, administrator protection, typed confirmation).
 *
 *   node scripts/qa/admin-flows.mjs /tmp/admin-flows
 */
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const scratch = mkdtempSync(path.join(tmpdir(), 'af-'));
writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;

const out = process.argv[2] ?? '/tmp/admin-flows';
mkdirSync(out, { recursive: true });

const results = [];
const check = (name, ok) => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

const browser = await chromium.launch({ executablePath: await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// Seed the preview session before the first document loads: a hash-only goto
// does not reload the page, so an init script added later would never run.
await page.addInitScript(() => {
  localStorage.setItem('msap.demo.session', 'd0000000-0000-4000-8000-000000000001');
  localStorage.setItem('msap.demo.email', 'admin@demo.local');
  localStorage.setItem('msap.launch.done', '1');
  localStorage.setItem('msap.launch.tour', '1');
});
await page.goto('http://127.0.0.1:5173/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.getByRole('tab', { name: /^Users$/ }).click();
await page.waitForTimeout(300);
check('admin console shows the account list', await page.getByText('alice@demo.local').first().isVisible());
check('account status is visible', (await page.getByText('Active', { exact: true }).count()) >= 2);

// Suspend: confirm dialog, then the badge flips.
await page.getByRole('button', { name: 'Suspend' }).first().click();
await page.waitForTimeout(250);
check('suspend asks for confirmation', await page.getByText('Suspend this account?').isVisible());
await page.screenshot({ path: path.join(out, '01-suspend-dialog.png') });
await page.getByRole('button', { name: 'Suspend account' }).click();
await page.waitForTimeout(500);
check('account shows as suspended', (await page.getByText('Suspended', { exact: true }).count()) >= 1);
await page.screenshot({ path: path.join(out, '02-suspended.png') });

// Restore puts it back.
await page.getByRole('button', { name: 'Restore' }).first().click();
await page.waitForTimeout(500);
check('restore clears the suspension', (await page.getByText('Suspended', { exact: true }).count()) === 0);

// Removal needs the exact email typed.
await page.getByRole('button', { name: 'Remove' }).first().click();
await page.waitForTimeout(250);
const removeButton = page.getByRole('button', { name: 'Remove permanently' });
const confirmField = page.getByLabel(/Type .* to confirm/);
const confirmLabel = await page.locator('label', { hasText: 'to confirm' }).first().innerText();
const targetEmail = /Type (.+?) to confirm/i.exec(confirmLabel)?.[1]?.trim() ?? '';
check('remove asks for typed confirmation', await page.getByText('Remove this account?').isVisible());
check('the dialog names the account being removed', Boolean(targetEmail));
check('remove is disabled until the email matches', await removeButton.isDisabled());
await confirmField.fill('not-the-email@demo.local');
await page.waitForTimeout(150);
check('wrong email keeps the button disabled', await removeButton.isDisabled());
await page.screenshot({ path: path.join(out, '03-remove-guard.png') });
await confirmField.fill(targetEmail);
await page.waitForTimeout(200);
check('correct email enables removal', !(await removeButton.isDisabled()));
await removeButton.click();
await page.waitForTimeout(900);
check('account disappears from the list', (await page.getByText(targetEmail, { exact: true }).count()) === 0);
await page.screenshot({ path: path.join(out, '04-after-remove.png') });

// Administrators are protected from both actions on the screen itself.
const adminCard = page.locator('[data-testid="admin-user-card"][data-role="admin"]');
check('the administrator card is present', (await adminCard.count()) === 1);
check('no suspend button for the administrator row', (await adminCard.getByRole('button', { name: 'Suspend' }).count()) === 0);
check('no remove button for the administrator row', (await adminCard.getByRole('button', { name: 'Remove' }).count()) === 0);

// The update card exists and reports the current build.
await page.goto('http://127.0.0.1:5173/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByText('Updates', { exact: true }).scrollIntoViewIfNeeded();
check('settings shows an Updates card', await page.getByText('Updates', { exact: true }).isVisible());
check('settings shows the installed version', await page.getByText(/Advanced Pro 2\.\d+\.\d+/).first().isVisible());
await page.screenshot({ path: path.join(out, '05-settings-updates.png') });

check('no uncaught page errors', pageErrors.length === 0);
if (pageErrors.length) console.log(pageErrors.join('\n'));

await browser.close();

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

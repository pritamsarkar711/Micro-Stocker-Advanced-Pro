// Exercise the actual UI against a deliberately fake Supabase API, without credentials.
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || await chromiumBinary.executablePath(), args: chromiumBinary.args, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.test', aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: { display_name: 'Tester' } };
  const jwt = (payload) => `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.test`;
  let entitled = false;
  let expiryAt = null;
  let blocked = false;
  const json = (route, obj, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(obj) });
  await context.route('https://test.supabase.co/**', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return json(route, {});
    if (url.pathname === '/auth/v1/signup') return json(route, { user, session: null });
    if (url.pathname === '/auth/v1/token') return json(route, { access_token: jwt({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' }), token_type: 'bearer', refresh_token: 'fake-refresh', expires_in: 3600, user });
    if (url.pathname === '/auth/v1/user') return json(route, user);
    if (url.pathname === '/auth/v1/logout') return json(route, {});
    if (url.pathname.endsWith('/msap_my_entitlement')) return json(route, [{ expires_at: entitled ? new Date(expiryAt ?? Date.now() + 3600_000).toISOString() : null, server_time: new Date().toISOString(), is_admin: false, is_blocked: blocked }]);
    if (url.pathname.endsWith('/msap_redeem_code')) {
      const body = req.postDataJSON();
      if (String(body.p_code ?? '').toUpperCase() !== 'VALIDTESTCODE') return json(route, { message: 'Invalid or unavailable code' }, 400);
      entitled = true;
      return json(route, [{ expires_at: new Date(Date.now() + 3600_000).toISOString(), server_time: new Date().toISOString() }]);
    }
    return json(route, { message: `Unexpected endpoint ${url.pathname}` }, 404);
  });
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/`);
  await page.getByRole('dialog', { name: 'Sign in' }).waitFor();
  const submit = page.getByRole('button', { name: 'Sign in', exact: true }).last();
  const contrast = async () => submit.evaluate((el) => {
    const style = getComputedStyle(el);
    const color = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number).map((c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    const luminance = (value) => { const rgb = color(value); return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722; };
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert.ok(await contrast() >= 4.5, 'sign-in text contrast');
  await submit.hover();
  await page.waitForTimeout(150);
  assert.ok(await contrast() >= 4.5, 'hover sign-in contrast');

  assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).count(), 0, 'workspace inaccessible before sign in');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByPlaceholder('Enter password').fill('valid-password');
  await page.getByRole('button', { name: 'Register and sign in' }).click();
  // Email links cannot reach a desktop build, so sign-up finishes with an in-app OTP.
  await page.getByRole('heading', { name: 'Verify your email' }).waitFor();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByPlaceholder('Enter password').fill('valid-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  try { await page.getByRole('navigation', { name: 'Main navigation' }).waitFor({timeout: 10000}); } catch (e) { console.error('Auth flow state:', await page.locator('body').innerText()); throw e; }
  assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).count(), 1, 'no duplicate sidebar');
  await page.getByText('Activate your subscription').waitFor();
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/#/bg-remove`);
  await page.getByText('Activate your subscription').waitFor();
  await page.getByRole('link', { name: 'Subscription details' }).click();
  await page.getByRole('heading', { name: 'Subscription', exact: true }).waitFor();
  await page.getByPlaceholder('Paste your code').fill('invalid-test-code');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.getByText('Invalid or unavailable code').waitFor();
  await page.getByPlaceholder('Paste your code').fill('valid-test-code');
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.getByText('Code activated.').waitFor();
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/#/bg-remove`);
  await page.getByRole('heading', { name: 'Background Remover' }).waitFor();
  const routes = ['/', '/library', '/prepare', '/export', '/upscale', '/video-upscale', '/bg-remove', '/convert', '/planner', '/plan', '/platforms', '/releases', '/bank', '/cloud', '/subscription', '/settings', '/contact', '/report', '/about', '/earnings'];
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/#${route}`);
      await page.locator('main').waitFor();
      await page.waitForTimeout(150);
      const overflow = await page.locator('main').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      assert.ok(overflow.scroll <= overflow.client + 1, `horizontal workspace overflow at ${width}px on ${route}: ${JSON.stringify(overflow)}`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  expiryAt = Date.now() + 3000;
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/#/subscription`);
  await page.getByRole('button', { name: 'Refresh', exact: true }).first().click();
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/#/bg-remove`);
  await page.getByRole('heading', { name: 'Background Remover' }).waitFor();
  await page.getByText('Your plan has expired.').waitFor({ timeout: 8000 });
  blocked = true;
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'}/#/subscription`);
  await page.getByRole('button', { name: 'Refresh', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Account disabled' }).waitFor();
  assert.deepEqual(failures, []);
  console.log('Auth UI: login gate, subscription activation, premium gate and blocked account passed (mock API)');
} finally { await browser.close(); }

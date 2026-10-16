import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { buildDirectionFixture } from '../../scripts/product-direction-fixtures.mjs';
import { createDirectionAdmin } from '../../scripts/product-direction-emulator-api.mjs';
const { app, db } = createDirectionAdmin();
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const { deleteApp } = require('firebase-admin/app');
test.afterAll(() => deleteApp(app));
const fixture = buildDirectionFixture({ scenario: 'routines' });
const response = (result) => ({ contentType: 'application/json', body: JSON.stringify({ result }) });
const ready = { checkout_available: true, portal_available: false, mode: 'test', binding_state: 'unbound' };
const billing = (page) => page.getByRole('region', { name: 'Core billing' });
const reset = () => promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=routines', '--write'], { env: process.env });
const login = async (page, path = '/dashboard/settings') => {
  await page.goto('/login'); await page.getByPlaceholder('you@example.com').fill(fixture.auth.email);
  await page.locator('input[type="password"]').fill(fixture.auth.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/); await page.goto(path);
};
const state = async () => (await db.collection('accountEntitlements').doc(fixture.parentId).get()).data();

test('public pricing and signup describe complete Free features, Core scale and unavailable Lockdown purchases', async ({ page }) => {
  await page.goto('/#pricing');
  const pricing = page.locator('#pricing');
  await expect(pricing.getByText('Daily Routines, daily points and built-in avatars', { exact: true })).toHaveCount(3);
  await expect(pricing.getByText('Unlimited students', { exact: true })).toHaveCount(2);
  await expect(pricing.getByText('$5/month', { exact: true })).toBeVisible();
  await expect(pricing.getByRole('button', { name: 'Coming soon', exact: true })).toBeDisabled();
  await expect(pricing).not.toContainText('10 students');
  await page.goto('/login?mode=signup');
  await expect(page.getByText(/Start Free with 2 students, 3 active curriculum records/)).toBeVisible();
});

test('unavailable billing and a forged success redirect preserve actual Free access and saved work', async ({ page }) => {
  await reset(); const before = await state();
  await page.route('**/getCoreBillingStatus', (route) => route.fulfill(response({ ...ready, checkout_available: false, mode: null })));
  await login(page, '/dashboard/settings?billing=success');
  await expect(billing(page).getByText(/Your plan updates after billing confirmation/)).toBeVisible();
  await expect(billing(page).getByText(/Self-serve Core billing is not available/)).toBeVisible();
  await expect(billing(page).getByRole('button', { name: /Upgrade|checkout/i })).toHaveCount(0);
  expect((await state()).plan_id).toBe('free');
  expect(await state()).toEqual(before);
  await expect(page.getByText('New custom reward setup is paused.', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/Core or Lockdown is required for/)).toHaveCount(0);
});

test('uncertain checkout keeps its exact intent across reload, blocks duplicate clicks and redirects only to the hosted provider', async ({ page }) => {
  await reset(); const before = await state();
  await page.route('**/getCoreBillingStatus', (route) => route.fulfill(response(ready)));
  let received;
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/createCoreCheckout', async (route) => {
    received = route.request().postDataJSON();
    await held;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Response lost' } }) });
  }, { times: 1 });
  await login(page);
  await expect(billing(page).getByText('Test billing · No live payments', { exact: true })).toBeVisible();
  await billing(page).getByRole('button', { name: 'Open test checkout', exact: true }).click();
  await expect(billing(page).getByRole('button', { name: 'Opening checkout…', exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(received)).toBe(true);
  expect(Object.keys(received.data).sort()).toEqual(['intent_id', 'return_target']);
  expect(received.data.return_target).toBe('settings');
  release();
  await expect(billing(page).getByRole('alert')).toContainText('Retry to safely continue');
  await page.reload();
  await expect(billing(page).getByRole('button', { name: 'Open test checkout', exact: true })).toBeVisible();
  let retry;
  await page.route('**/createCoreCheckout', (route) => {
    retry = route.request().postDataJSON();
    return route.fulfill(response({ url: 'https://checkout.stripe.com/c/pay/cs_test_browser_fixture', reused: true }));
  }, { times: 1 });
  // Provider navigation is a simulated boundary; no Stripe objects or charges.
  await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Hosted test checkout boundary</h1>' }));
  await billing(page).getByRole('button', { name: 'Open test checkout', exact: true }).click();
  await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test_browser_fixture');
  expect(retry).toEqual(received);
  expect(await state()).toEqual(before);
});

test('billing read retry, unsafe provider URL denial and downgraded subscription management remain usable on mobile', async ({ page }) => {
  await reset(); await page.setViewportSize({ width: 390, height: 844 });
  let available = false;
  await page.route('**/getCoreBillingStatus', (route) => !available
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Try again' } }) })
    : route.fulfill(response({ ...ready, checkout_available: false, portal_available: true, binding_state: 'bound' })));
  await login(page);
  await expect(billing(page).getByRole('alert')).toBeVisible();
  available = true;
  await billing(page).getByRole('button', { name: 'Retry billing options', exact: true }).click();
  const manage = billing(page).getByRole('button', { name: 'Manage test subscription', exact: true });
  await expect(manage).toBeVisible(); await manage.focus(); await expect(manage).toBeFocused();
  await page.route('**/createBillingPortal', (route) => route.fulfill(response({ url: 'https://untrusted.example/billing' })), { times: 1 });
  await page.keyboard.press('Enter');
  await expect(billing(page).getByRole('alert')).toContainText('Billing management could not be opened');
  await expect(page).toHaveURL(/\/dashboard\/settings/);
  await page.route('**/createBillingPortal', (route) => route.fulfill(response({ url: 'https://billing.stripe.com/p/session/test_browser_fixture' })), { times: 1 });
  await page.route('https://billing.stripe.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Hosted billing management boundary</h1>' }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await billing(page).screenshot({ path: 'tmp/product-direction/browser-billing-mobile.png' });
  await manage.click();
  await expect(page).toHaveURL('https://billing.stripe.com/p/session/test_browser_fixture');
  expect((await state()).plan_id).toBe('free');
});

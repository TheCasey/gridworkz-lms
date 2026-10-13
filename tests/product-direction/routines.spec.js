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
test.setTimeout(60000);

const resetScenario = async (scenario, activate = true) => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', `--scenario=${scenario}`, '--write'], { env: process.env });
  const fixture = buildDirectionFixture({ scenario });
  if (activate) await db.collection('accountEntitlements').doc(fixture.parentId).update({ product_direction_version: 1 });
  return fixture;
};
const enterStudent = async (page, student) => {
  await page.goto(`/student/${student.slug}`);
  await page.getByLabel('Student PIN').fill(student.access_pin);
  await page.getByRole('button', { name: 'Enter portal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'School', exact: true })).toBeVisible();
};
const enterParent = async (page, fixture, path = '/dashboard/chores/daily-routines') => {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(fixture.auth.email);
  await page.locator('input[type="password"]').fill(fixture.auth.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(path);
};
const wallet = async (student) => (await db.collection('studentPointWallets').doc(student.id).get()).data();
const assertReadable = async (locator) => {
  const ratio = await locator.evaluate((element) => {
    const channels = (value) => value.match(/[\d.]+/g).map(Number);
    const blend = (front, back) => front.slice(0, 3).map((channel, i) => channel * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
    const background = (node) => {
      if (!node) return [255, 255, 255];
      const rgba = channels(getComputedStyle(node).backgroundColor);
      return blend(rgba, (rgba[3] ?? 1) < 1 ? background(node.parentElement) : [255, 255, 255]);
    };
    const bg = background(element);
    const fg = blend(channels(getComputedStyle(element).color), bg);
    const luminance = (rgb) => rgb.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((value, channel, i) => value + channel * [0.2126, 0.7152, 0.0722][i], 0);
    const levels = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (levels[0] + 0.05) / (levels[1] + 0.05);
  });
  expect(ratio, 'Visible text must remain readable on its rendered card in the current theme').toBeGreaterThanOrEqual(4.5);
};


// Browser scenarios below exercise actual Firebase-backed UI and assert persisted records.

test('Free student completes frozen day, unlocks/equips and retains choices on reload and second device', async ({ page, browser }) => {
  const fixture = await resetScenario('routines');
  const student = fixture.students[0];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterStudent(page, student);
  await page.getByTestId('student-portal-chores-tab').click();
  for (const period of ['morning', 'afternoon', 'evening']) {
    const routine = page.getByTestId(`routine-${student.id}_${period}`);
    await routine.getByText('Complete this routine', { exact: true }).click();
    await routine.getByRole('button', { name: 'Complete routine', exact: true }).click();
    await expect(routine.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  }
  await expect.poll(async () => (await wallet(student)).total_points).toBe(50);
  await page.getByTestId('student-portal-avatar-tab').click();
  await assertReadable(page.getByTestId('cosmetic-builtin_avatar_stargazer').getByRole('heading'));
  await assertReadable(page.getByRole('button', { name: 'Unlock Stargazer', exact: true }));
  await assertReadable(page.getByTestId('equipped-cosmetics').getByRole('heading'));
  await page.getByRole('button', { name: 'Unlock Stargazer', exact: true }).click();
  await expect.poll(async () => (await wallet(student)).total_points).toBe(30);
  await page.getByRole('button', { name: 'Equip Stargazer', exact: true }).click();
  await expect(page.getByTestId('cosmetic-builtin_avatar_stargazer')).toContainText(/equipped/i);
  await page.reload();
  await page.getByLabel('Student PIN').fill(student.access_pin);
  await page.getByRole('button', { name: 'Enter portal', exact: true }).click();
  await page.getByTestId('student-portal-avatar-tab').click();
  await expect(page.getByTestId('cosmetic-builtin_avatar_stargazer')).toContainText(/equipped/i);
  await page.getByRole('button', { name: 'Unlock Twilight', exact: true }).click();
  await expect.poll(async () => (await wallet(student)).total_points).toBe(0);
  await page.getByRole('button', { name: 'Equip Twilight', exact: true }).click();
  await expect(page.locator('[data-routine-theme="builtin_theme_twilight"]')).toBeVisible();
  await assertReadable(page.getByTestId('cosmetic-builtin_avatar_stargazer').getByRole('heading'));
  await assertReadable(page.getByTestId('equipped-cosmetics').getByRole('heading'));
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3107' });
  try {
    const otherPage = await otherContext.newPage();
    await enterStudent(otherPage, student);
    await otherPage.getByTestId('student-portal-avatar-tab').click();
    await expect(otherPage.getByTestId('cosmetic-builtin_avatar_stargazer')).toContainText(/equipped/i);
    await expect(otherPage.locator('[data-routine-theme="builtin_theme_twilight"]')).toBeVisible();
    expect((await wallet(student)).total_points).toBe(0);
  } finally { await otherContext.close(); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'tmp/product-direction/browser-cosmetics-persisted.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Free parent saves narrow settings and suspended direct links reach private history', async ({ page }) => {
  const fixture = await resetScenario('routines');
  const forbiddenCalls = [];
  page.on('request', (request) => {
    if (/\/(syncAllowanceLedger|adjustStudentPoints|upsertChoreDefinition|upsertRewardCatalogItem)$/.test(request.url())) forbiddenCalls.push(request.url());
  });
  await enterParent(page, fixture);
  await page.getByLabel('Daily points', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Save routine settings', exact: true }).click();
  await expect.poll(async () => (await db.collection('rewardSettings').doc(fixture.parentId).get()).data()?.routine_day_points).toBe(12);
  await page.getByLabel('Student', { exact: true }).selectOption(fixture.students[1].id);
  await page.getByLabel('Morning', { exact: true }).fill('Sibling checklist');
  await page.getByRole('button', { name: 'Save Morning', exact: true }).click();
  await expect.poll(async () => (await db.collection('routineTemplates').doc(`${fixture.students[1].id}_morning`).get()).data()?.checklist_items[0]?.label).toBe('Sibling checklist');
  expect((await db.collection('routineTemplates').doc(`${fixture.students[0].id}_morning`).get()).data().checklist_items[0].label).toBe('Complete this routine');
  await page.goto('/dashboard/chores/weekly-chores');
  await expect(page).toHaveURL(/\/chores\/household-history$/);
  await expect(page.getByRole('heading', { name: 'Household History', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /new chore|add reward|sync allowance/i })).toHaveCount(0);
  expect(forbiddenCalls).toEqual([]);
});

test('mobile daily routine completion supports keyboard and has no horizontal overflow', async ({ page }) => {
  const fixture = await resetScenario('routine_disabled');
  await page.setViewportSize({ width: 375, height: 812 });
  await enterStudent(page, fixture.students[0]);
  await page.getByRole('button', { name: 'Daily Routines', exact: true }).click();
  const morning = page.getByTestId(`routine-${fixture.students[0].id}_morning`);
  await assertReadable(morning.getByRole('heading'));
  await assertReadable(morning.getByText('Complete this routine', { exact: true }));
  await morning.getByRole('checkbox').focus();
  await morning.getByRole('checkbox').press('Space');
  await expect(morning.getByRole('checkbox')).toBeChecked();
  await morning.getByRole('button', { name: 'Complete routine', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(morning.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  expect((await wallet(fixture.students[0])).total_points).toBe(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'tmp/product-direction/browser-routines-mobile.png', fullPage: true });
});

test('routine load failure offers retry without losing verified student access', async ({ page }) => {
  const fixture = await resetScenario('routines');
  let failNext = true;
  await page.route('**/readStudentChoreState', async (route) => {
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Please retry loading routines.' } }) });
    } else await route.continue();
  });
  await enterStudent(page, fixture.students[0]);
  await page.getByTestId('student-portal-chores-tab').click();
  await expect(page.getByRole('button', { name: 'Retry loading', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await expect(page.getByText('morning routine', { exact: true })).toBeVisible();
  expect((await wallet(fixture.students[0])).total_points).toBe(40);
});

test('downgraded parent settles original history once; student never sees household obligations', async ({ page }) => {
  const fixture = await resetScenario('legacy');
  await db.collection('accountEntitlements').doc(fixture.parentId).update({ plan_id: 'free' });
  await enterParent(page, fixture, '/dashboard/chores/household-history');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel and refund', exact: true }).click();
  await expect.poll(async () => (await wallet(fixture.students[0])).total_points).toBe(40);
  await expect(page.getByRole('button', { name: 'Cancel and refund', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Acknowledge payment', exact: true }).click();
  await expect.poll(async () => (await db.collection('allowancePeriods').doc(`${fixture.parentId}_unpaid`).get()).data()?.paid_status).toBe('paid');
  const events = await db.collection('householdHistoryEvents').where('parent_id', '==', fixture.parentId).get();
  expect(events.size).toBe(2);
  await page.screenshot({ path: 'tmp/product-direction/browser-household-history.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await enterStudent(page, fixture.students[0]);
  await page.getByTestId('student-portal-chores-tab').click();
  await expect(page.getByText('Historical custom reward', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Household History', { exact: true })).toHaveCount(0);
});

test('new Free household bootstraps through release gate and sets up its first checklist', async ({ page }) => {
  const fixture = await resetScenario('single');
  const student = fixture.students[0];
  await db.collection('accountEntitlements').doc(fixture.parentId).delete();
  await db.collection('productDirectionConfig').doc('routineFirst').set({ version: 1, new_accounts_enabled: true });
  for (const period of ['morning', 'afternoon', 'evening']) await db.collection('routineTemplates').doc(`${student.id}_${period}`).delete();
  await db.collection('studentPointWallets').doc(student.id).delete();
  const cosmeticRecord = fixture.documents.find((record) => record.collection === 'studentCosmeticStates');
  await db.collection('studentCosmeticStates').doc(cosmeticRecord.id).delete();
  try {
    await enterParent(page, fixture);
    await expect(page.getByTestId('parent-daily-routines')).toBeVisible();
    await page.getByLabel('Morning', { exact: true }).fill('Brush teeth\nPack books');
    await page.getByRole('button', { name: 'Save Morning', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Morning saved' })).toBeVisible();
    const account = (await db.collection('accountEntitlements').doc(fixture.parentId).get()).data();
    expect(account.plan_id).toBe('free');
    expect(account.product_direction_version).toBe(1);
    await enterStudent(page, student);
    await page.getByTestId('student-portal-chores-tab').click();
    await expect(page.getByText('Brush teeth', { exact: true })).toBeVisible();
    await expect(page.getByText('Pack books', { exact: true })).toBeVisible();
    await expect(page.getByTestId('student-daily-routines').getByRole('checkbox')).toHaveCount(2);
    await page.getByText('Brush teeth', { exact: true }).click();
    await page.getByText('Pack books', { exact: true }).click();
    await page.getByRole('button', { name: 'Complete routine', exact: true }).click();
    await expect.poll(async () => (await wallet(student))?.total_points).toBe(10);
    await page.getByTestId('student-portal-avatar-tab').click();
    await page.getByRole('button', { name: 'Unlock Comet', exact: true }).click();
    await page.getByRole('button', { name: 'Equip Comet', exact: true }).click();
    await expect(page.getByTestId('cosmetic-builtin_badge_comet')).toContainText(/equipped/i);
    expect((await wallet(student)).total_points).toBe(0);
  } finally { await db.collection('productDirectionConfig').doc('routineFirst').set({ version: 1, new_accounts_enabled: false }); }
});

test('empty Free household gets a usable setup empty state without premium controls', async ({ page }) => {
  const fixture = await resetScenario('empty');
  await enterParent(page, fixture);
  await expect(page.getByRole('heading', { name: 'Add a student to begin', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Students', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save routine settings', exact: true })).toBeEnabled();
  await page.goto('/dashboard/chores/household-history');
  await expect(page.getByRole('heading', { name: 'No household history yet', exact: true })).toBeVisible();
});

test('saving one period and reward settings preserves unsaved edits in another period', async ({ page }) => {
  const fixture = await resetScenario('routines');
  await enterParent(page, fixture);
  await page.getByLabel('Morning', { exact: true }).fill('Saved morning item');
  await page.getByLabel('Afternoon', { exact: true }).fill('Afternoon still being edited');
  await page.getByRole('button', { name: 'Save Morning', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Morning saved' })).toBeVisible();
  await expect(page.getByLabel('Afternoon', { exact: true })).toHaveValue('Afternoon still being edited');
  await page.getByLabel('Daily points', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Save routine settings', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Daily award settings saved' })).toBeVisible();
  await expect(page.getByLabel('Afternoon', { exact: true })).toHaveValue('Afternoon still being edited');
  expect((await db.collection('routineTemplates').doc(`${fixture.students[0].id}_afternoon`).get()).data().checklist_items[0].label).toBe('Complete this routine');
});

test('unavailable new-account initialization blocks legacy writes and offers a working access retry', async ({ page }) => {
  const fixture = await resetScenario('single');
  await db.collection('accountEntitlements').doc(fixture.parentId).delete();
  await db.collection('productDirectionConfig').doc('routineFirst').set({ version: 1, new_accounts_enabled: true });
  let unavailable = true;
  await page.route('**/initializeRoutineFirstAccount', async (route) => {
    if (unavailable) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Account access temporarily unavailable.' } }) });
    else await route.continue();
  });
  try {
    await enterParent(page, fixture);
    await expect(page.getByRole('button', { name: 'Retry access', exact: true })).toBeVisible();
    await expect(page.getByTestId('parent-daily-routines')).toHaveCount(0);
    unavailable = false;
    await page.getByRole('button', { name: 'Retry access', exact: true }).click();
    await expect(page.getByTestId('parent-daily-routines')).toBeVisible();
    expect((await db.collection('accountEntitlements').doc(fixture.parentId).get()).data().product_direction_version).toBe(1);
  } finally { await db.collection('productDirectionConfig').doc('routineFirst').set({ version: 1, new_accounts_enabled: false }); }
});

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
const reset = async () => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=free', '--write'], { env: process.env });
  const fixture = buildDirectionFixture({ scenario: 'free' });
  await db.collection('accountEntitlements').doc(fixture.parentId).update({ product_direction_version: 1 });
  return fixture;
};
const parent = async (page, fixture) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(fixture.auth.email);
  await page.locator('input[type="password"]').fill(fixture.auth.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/dashboard/weekly-blocking');
  await page.getByLabel('Student', { exact: true }).selectOption(fixture.students[0].id);
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeEnabled();
};
const student = async (page, record) => {
  await page.goto(`/student/${record.slug}`);
  await page.getByLabel('Student PIN').fill(record.access_pin);
  await page.getByRole('button', { name: 'Enter portal', exact: true }).click();
  await expect(page.getByTestId('student-school-workspace')).toBeVisible();
};
const record = async (collection, id) => (await db.collection(collection).doc(id).get()).data();
const planId = (fixture) => fixture.documents.find((entry) => entry.collection === 'weeklyPlans' && entry.data.student_id === fixture.students[0].id).id;
const responseTo = (page, name) => page.waitForResponse((response) => response.url().endsWith(`/${name}`) && response.request().method() === 'POST');
const add = (page) => page.getByRole('button', { name: 'Add Subject 1 block block', exact: true }).first();
const publish = async (page) => {
  page.once('dialog', (dialog) => dialog.accept());
  const response = responseTo(page, 'publishWeeklyPlan');
  await page.getByRole('button', { name: 'Publish This Week', exact: true }).click();
  const body = await (await response).json();
  expect(body.result, JSON.stringify(body)).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Publish This Week', exact: true })).toBeEnabled();
  return body.result;
};

test('draft/default persistence is isolated; publish uses current unsaved selections and stable copies', async ({ page, browser }) => {
  const fixture = await reset();
  const id = planId(fixture);
  const original = await record('weeklyPlans', id);
  const subjectsBefore = await Promise.all(fixture.subjects.map((subject) => record('subjects', subject.id)));
  await parent(page, fixture);
  await expect(page.getByText(/Saved draft differs from published week/)).toBeVisible();
  await add(page).click();
  const saved = responseTo(page, 'saveWeeklyPlanDraft');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await (await saved).json()).result).toBeTruthy();
  await expect.poll(async () => (await record('weeklyPlanDrafts', id)).blocks.length).toBe(2);
  expect(await record('weeklyPlans', id)).toEqual(original);
  const defaults = responseTo(page, 'saveStudentDefaultWeek');
  await page.getByRole('button', { name: 'Save as Default Week', exact: true }).click();
  expect((await (await defaults).json()).result).toBeTruthy();
  expect(await record('weeklyPlans', id)).toEqual(original);
  expect(await Promise.all(fixture.subjects.map((subject) => record('subjects', subject.id)))).toEqual(subjectsBefore);
  expect(await record('studentDefaultWeeks', `${fixture.parentId}_${fixture.students[1].id}`)).toBeUndefined();
  const savedBlocks = (await record('weeklyPlanDrafts', id)).blocks;
  await add(page).click();
  await publish(page);
  const live = await record('weeklyPlans', id);
  expect(live.blocks.length).toBe(3);
  expect(live.blocks.slice(0, 2).map((block) => block.id)).toEqual(savedBlocks.map((block) => block.id));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeEnabled();
  await page.getByLabel('Student', { exact: true }).selectOption(fixture.students[0].id);
  await page.getByLabel('Week', { exact: true }).selectOption('1');
  await expect(page.getByText(/No saved private draft/)).toBeVisible();
  await expect(page.locator('.qi-val').first()).toHaveText('2');
  const context = await browser.newContext();
  const portal = await context.newPage();
  await student(portal, fixture.students[0]);
  await expect(portal.getByRole('button', { name: /Subject 1.*0 of 3 blocks complete/ })).toBeVisible();
  await page.screenshot({ path: 'tmp/product-direction/browser-planning-default-next-week.png', fullPage: true });
  await context.close();
});

test('dirty second tab keeps its baseline and edits on conflict until explicit reload', async ({ page, context }) => {
  const fixture = await reset();
  await parent(page, fixture);
  const second = await context.newPage();
  await second.goto('/dashboard/weekly-blocking');
  await second.getByLabel('Student', { exact: true }).selectOption(fixture.students[0].id);
  await expect(second.getByRole('button', { name: 'Save Draft', exact: true })).toBeEnabled();
  await add(second).click();
  await add(second).click();
  await add(page).click();
  const saved = responseTo(page, 'saveWeeklyPlanDraft');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await (await saved).json()).result).toBeTruthy();
  await expect(second.getByText(/saved version changed/).first()).toBeVisible();
  const conflict = responseTo(second, 'saveWeeklyPlanDraft');
  await second.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await (await conflict).json()).error.status).toBe('ABORTED');
  await expect(second.getByRole('alert')).toContainText('Your edits are still here');
  await expect(second.locator('.qi-val').first()).toHaveText('3');
  await second.getByRole('button', { name: 'Reload and review', exact: true }).click();
  await expect(second.locator('.qi-val').first()).toHaveText('2');
  await second.close();
});

test('uncertain successful save retries the identical request and never increments twice', async ({ page }) => {
  const fixture = await reset();
  await parent(page, fixture);
  await add(page).click();
  let firstPayload;
  await page.route('**/saveWeeklyPlanDraft', async (route) => {
    firstPayload = route.request().postDataJSON();
    const committed = await route.fetch();
    expect((await committed.json()).result).toBeTruthy();
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Simulated response loss after commit' } }) });
  }, { times: 1 });
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('retry');
  const after = await record('weeklyPlanDrafts', planId(fixture));
  const retry = responseTo(page, 'saveWeeklyPlanDraft');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  const response = await retry;
  expect(response.request().postDataJSON()).toEqual(firstPayload);
  expect((await response.json()).result.replayed).toBe(true);
  expect((await record('weeklyPlanDrafts', planId(fixture))).revision).toBe(after.revision);
});

test('empty and missing adopted weeks stay empty across reload and a fresh device', async ({ page, browser }) => {
  const fixture = await reset();
  await parent(page, fixture);
  await page.getByRole('button', { name: 'Remove Subject 1 block block', exact: true }).first().click();
  await publish(page);
  expect((await record('weeklyPlans', planId(fixture))).blocks).toEqual([]);
  const context = await browser.newContext();
  const portal = await context.newPage();
  await student(portal, fixture.students[0]);
  await expect(portal.locator('.student-subject-row')).toHaveCount(0);
  await db.collection('weeklyPlans').doc(planId(fixture)).delete();
  await portal.reload();
  await portal.getByLabel('Student PIN').fill(fixture.students[0].access_pin);
  await portal.getByRole('button', { name: 'Enter portal', exact: true }).click();
  await expect(portal.getByTestId('student-school-workspace')).toBeVisible();
  await expect(portal.locator('.student-subject-row')).toHaveCount(0);
  await context.close();
});

test('only timed blocks show controls; non-timed same-subject completion preserves an active timer', async ({ page }) => {
  const fixture = await reset();
  const id = planId(fixture);
  const original = await record('weeklyPlans', id);
  const blocks = original.blocks.filter((block) => block.legacy_subject_id === fixture.subjects[0].id).slice(0, 2)
    .map((block, index) => ({ ...block, title: index === 0 ? 'Timed practice' : 'Untimed reading', require_timer: index === 0, require_input: false }));
  await db.collection('weeklyPlans').doc(id).update({ blocks });
  await db.collection('students').doc(fixture.students[0].id).update({ weekly_planning_version: 1 });
  await student(page, fixture.students[0]);
  await page.getByRole('button', { name: /Subject 1.*0 of 2 blocks complete/ }).click();
  await page.locator('.student-block-chip').first().click();
  await expect(page.getByTestId('school-block-timer')).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const timerId = `${fixture.students[0].id}_${fixture.subjects[0].id}`;
  await expect.poll(async () => Boolean(await record('timerSessions', timerId))).toBe(true);
  await page.locator('.student-block-chip').nth(1).click();
  await expect(page.getByTestId('school-block-timer')).toHaveCount(0);
  await expect(page.getByText('No timer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Complete block', exact: true }).click();
  await page.getByRole('button', { name: 'Finish Block', exact: true }).click();
  await expect.poll(async () => (await db.collection('submissions').where('student_id', '==', fixture.students[0].id).get()).size).toBe(1);
  expect(await record('timerSessions', timerId)).toBeTruthy();
  await page.locator('.student-block-chip').first().click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await db.collection('weeklyPlans').doc(id).update({ revision: 2, blocks: blocks.map((block) => ({ ...block, require_timer: false })) });
  await expect(page.getByTestId('school-block-timer')).toHaveCount(0);
  await expect.poll(async () => await record('timerSessions', timerId)).toBeUndefined();
  await page.screenshot({ path: 'tmp/product-direction/browser-planning-no-timer.png', fullPage: true });
});

test('republishing removed work closes an open completion form without writing evidence', async ({ page }) => {
  const fixture = await reset();
  const id = planId(fixture);
  const live = await record('weeklyPlans', id);
  const block = { ...live.blocks[0], require_timer: false, require_input: false };
  await db.collection('weeklyPlans').doc(id).update({ blocks: [block] });
  await db.collection('students').doc(fixture.students[0].id).update({ weekly_planning_version: 1 });
  await student(page, fixture.students[0]);
  await page.getByRole('button', { name: /Subject 1.*0 of 1 blocks complete/ }).click();
  await page.locator('.student-block-chip').first().click();
  await page.getByRole('button', { name: 'Complete block', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish Block', exact: true })).toBeVisible();
  await db.collection('weeklyPlans').doc(id).update({ blocks: [], revision: 2 });
  await expect(page.getByRole('button', { name: 'Finish Block', exact: true })).toHaveCount(0);
  expect((await db.collection('submissions').where('student_id', '==', fixture.students[0].id).get()).size).toBe(0);
});

test('open portal crosses a custom reset and replaces plan and completion listeners', async ({ page }) => {
  const fixture = await reset();
  const id = planId(fixture);
  const live = await record('weeklyPlans', id);
  const custom = { timezone: 'America/Chicago', week_reset_day: 3, week_reset_hour: 14, week_reset_minute: 30, weekly_planning_version: 1 };
  const beforeKey = '2026-10-07';
  const afterKey = '2026-10-14';
  const scopedId = (key) => `${fixture.parentId}_${fixture.students[0].id}_${key}`;
  const blocks = live.blocks.filter((block) => block.legacy_subject_id === fixture.subjects[0].id).slice(0, 2)
    .map((block) => ({ ...block, require_timer: false, require_input: false }));
  await db.collection('students').doc(fixture.students[0].id).update(custom);
  await db.collection('weeklyPlans').doc(scopedId(beforeKey)).set({ ...live, id: scopedId(beforeKey), week_key: beforeKey, blocks });
  await db.collection('weeklyPlans').doc(scopedId(afterKey)).set({ ...live, id: scopedId(afterKey), week_key: afterKey,
    blocks: blocks.map((block) => ({ ...block, title: 'New week reading' })) });
  await db.collection('submissions').doc('direction_boundary_prior').set({ parent_id: fixture.parentId, student_id: fixture.students[0].id,
    subject_id: fixture.subjects[0].id, block_index: blocks[0].legacy_block_index, timestamp: new Date('2026-10-14T19:28Z') });
  await page.clock.install({ time: new Date('2026-10-14T19:29Z') });
  await student(page, fixture.students[0]);
  await expect(page.getByRole('button', { name: /Subject 1.*1 of 2 blocks complete/ })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page.getByRole('button', { name: /Subject 1.*0 of 2 blocks complete/ })).toBeVisible();
  await page.getByRole('button', { name: /Subject 1.*0 of 2 blocks complete/ }).click();
  await page.locator('.student-block-chip').first().click();
  await expect(page.getByRole('heading', { name: 'New week reading', exact: true })).toBeVisible();
});

test('timed work survives pause/resume and completes only after its timer finishes', async ({ page }) => {
  const fixture = await reset();
  const id = planId(fixture);
  const live = await record('weeklyPlans', id);
  await db.collection('weeklyPlans').doc(id).update({ blocks: [live.blocks[0]] });
  await page.clock.install({ time: new Date() });
  await student(page, fixture.students[0]);
  await page.getByRole('button', { name: /Subject 1.*0 of 1 blocks complete/ }).click();
  await page.locator('.student-block-chip').first().click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await page.locator('#summary').fill('I worked through the assigned practice and checked each answer carefully. I reviewed the steps that were difficult and explained what I learned in my own words.');
  await page.getByRole('button', { name: 'Finish Block', exact: true }).click();
  await expect.poll(async () => (await db.collection('submissions').where('student_id', '==', fixture.students[0].id).get()).size).toBe(1);
  await expect(page.getByRole('button', { name: /Subject 1.*1 of 1 blocks complete/ })).toBeVisible();
});

test('planning actions remain reachable on a small screen', async ({ page }) => {
  const fixture = await reset();
  await page.setViewportSize({ width: 390, height: 844 });
  await parent(page, fixture);
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeVisible();
  expect((await page.locator('.op-weekly-proto').boundingBox()).width).toBeGreaterThan(350);
  expect((await page.getByRole('heading', { name: 'Weekly Plan', exact: true }).boundingBox()).width).toBeGreaterThan(200);
  for (const name of ['Save Draft', 'Save as Default Week', 'Publish This Week']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.locator('#parent-navigation').getByRole('link', { name: 'Students', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  await page.getByLabel('Week', { exact: true }).focus();
  await expect(page.getByLabel('Week', { exact: true })).toBeFocused();
  await page.screenshot({ path: 'tmp/product-direction/browser-planning-mobile.png', fullPage: true });
});

import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { buildDirectionFixture } from '../../scripts/product-direction-fixtures.mjs';
import { createDirectionAdmin, callDirectionFunction as call, directionStudentContext, signInDirectionParent } from '../../scripts/product-direction-emulator-api.mjs';
const { app, db } = createDirectionAdmin();
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const { deleteApp } = require('firebase-admin/app');
test.afterAll(() => deleteApp(app));
test.setTimeout(60000);
const fixture = buildDirectionFixture({ scenario: 'corrections' }); const student = fixture.students[0];
const initial = fixture.documents.find((item) => item.collection === 'weeklyPlans' && item.data.student_id === student.id);
const region = (page) => page.getByRole('region', { name: 'School block details and corrections' });
const responseTo = (page, name) => page.waitForResponse((response) => response.url().endsWith(`/${name}`) && response.request().method() === 'POST');
const read = async (collection, id) => (await db.collection(collection).doc(id).get()).data();
const ok = (body) => { expect(body.result, JSON.stringify(body)).toBeTruthy(); return body.result; };
const reset = async () => promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=corrections', '--write'], { env: process.env });
const parent = async (page, route = 'weekly-blocking') => {
  await page.goto('/login'); await page.getByPlaceholder('you@example.com').fill(fixture.auth.email);
  await page.locator('input[type="password"]').fill(fixture.auth.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await expect(page).toHaveURL(/\/dashboard/);
  if (route) await page.goto(`/dashboard/${route}`);
  if (route === 'weekly-blocking') await page.getByLabel('Student', { exact: true }).selectOption(student.id);
  if (!route) {
    await page.getByRole('button', { name: new RegExp(`${student.name} /student`) }).click();
    await page.getByRole('button', { name: 'School', exact: true }).click();
  }
  await expect(region(page)).toBeVisible();
};
const portal = async (page) => {
  await page.goto(`/student/${student.slug}`); await page.getByLabel('Student PIN').fill(student.access_pin);
  await page.getByRole('button', { name: 'Enter portal', exact: true }).click();
  await expect(page.getByTestId('student-school-workspace')).toBeVisible();
};
const select = async (page, name = /Subject 2 block.*1.*Incomplete/) => region(page).getByRole('button', { name }).first().click();
const save = async (page, button) => {
  const response = responseTo(page, 'correctSchoolBlock');
  await region(page).getByRole('button', { name: button }).click(); return ok(await (await response).json());
};

test('dashboard undo preserves evidence, updates a second student device and creates a selectable report amendment', async ({ page, browser }) => {
  await reset();
  const state = ok(await call('getStudentSchoolState', directionStudentContext(student)));
  const block = state.weekly_plan.blocks.find((item) => !item.require_timer);
  const submission = ok(await call('submitSchoolBlock', { ...directionStudentContext(student), week_key: state.week_key, weekly_block_id: block.id,
    expected_revision: 0, idempotency_key: 'browser-initial-evidence', summary_text: 'Original reading reflection remains available after undo.', resources_used: [], custom_field_responses: {} }));
  const originalEvidence = await read('submissions', submission.submission_id);
  const reportId = `${fixture.parentId}_browser_original`;
  const originalReport = { id: reportId, parent_id: fixture.parentId, student_id: student.id, student_name: student.name,
    week_key: state.week_key, weekly_plan_id: state.weekly_plan_id, week_start: initial.data.week_start, week_end: initial.data.week_end, week_ending: initial.data.week_end,
    snapshot_model: 'weekly_plan', total_blocks: 1, weekly_goal: state.blocks.length, total_hours: 0, subject_ids: [block.legacy_subject_id], subject_titles: ['Subject 2'],
    subjects_data: { [block.legacy_subject_id]: { subjectTitle: 'Subject 2', totalBlocks: 1, goalBlocks: 2, totalMinutes: 0,
      summaries: [{ text: originalEvidence.summary_text, blockNumber: 1, date: initial.data.week_start, duration: 0 }] } },
    assigned_blocks_snapshot: state.weekly_plan.blocks.map((item) => ({ blockId: item.id, assignmentId: item.assignment_id,
      legacySubjectId: item.legacy_subject_id, legacyBlockIndex: item.legacy_block_index, completed: item.id === block.id })) };
  await db.collection('weeklyReports').doc(reportId).set(originalReport);
  const originalStored = await read('weeklyReports', reportId);
  const context = await browser.newContext(); const second = await context.newPage(); await portal(second);
  await expect(second.getByRole('button', { name: /Subject 2.*1 of 2 blocks complete/ })).toBeVisible();
  await parent(page, '');
  await select(page, /Subject 2 block.*1.*Complete/);
  await region(page).getByLabel('Reason (required)').fill('Reopen for additional reading');
  await save(page, /Undo completion/);
  await expect(second.getByRole('button', { name: /Subject 2.*0 of 2 blocks complete/ })).toBeVisible();
  expect(await read('submissions', submission.submission_id)).toEqual(originalEvidence);
  expect(await read('weeklyReports', reportId)).toEqual(originalStored);
  await region(page).getByText('Original evidence (1)', { exact: true }).click();
  await expect(region(page).getByText(originalEvidence.summary_text, { exact: true })).toBeVisible();
  await page.goto('/dashboard/reports');
  await page.getByRole('button', { name: 'Show records', exact: true }).click();
  await page.getByRole('button', { name: 'Details & corrections', exact: true }).first().click();
  const details = page.getByRole('dialog', { name: 'Official report details' });
  await expect(details.getByText(/Selected version: 1\/6 completed blocks/)).toBeVisible();
  await details.getByLabel('Report version').selectOption({ label: 'Amendment · Version 2' });
  await expect(details.getByText(/Selected version: 0\/6 completed blocks/)).toBeVisible();
  await details.getByLabel('Report version').selectOption(reportId);
  await expect(details.getByText(/Selected version: 1\/6 completed blocks/)).toBeVisible();
  await second.getByRole('button', { name: /Subject 2.*0 of 2 blocks complete/ }).click();
  await second.locator('.student-block-chip').first().click();
  await second.getByRole('button', { name: 'Complete block', exact: true }).click();
  await second.getByRole('button', { name: 'Finish Block', exact: true }).click();
  await expect(second.getByRole('button', { name: /Subject 2.*1 of 2 blocks complete/ })).toBeVisible();
  expect((await db.collection('submissions').where('student_id', '==', student.id).get()).size).toBe(2);
  await page.screenshot({ path: 'tmp/product-direction/browser-correction-report-history.png', fullPage: true });
  await context.close();
});

test('uncertain parent correction retains exact request across navigation and never increments twice', async ({ page }) => {
  await reset(); await parent(page); await select(page);
  await region(page).getByLabel('Reason (required)').fill('Observed parent-led reading');
  let original;
  await page.route('**/correctSchoolBlock', async (route) => {
    original = route.request().postDataJSON(); const committed = await route.fetch(); expect((await committed.json()).result).toBeTruthy();
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Response lost after commit' } }) });
  }, { times: 1 });
  await region(page).getByRole('button', { name: 'Mark complete as parent correction', exact: true }).click();
  await expect(region(page).getByRole('button', { name: 'Retry exact correction', exact: true })).toBeVisible();
  await page.reload(); await page.getByLabel('Student', { exact: true }).selectOption(student.id);
  const response = responseTo(page, 'correctSchoolBlock');
  await region(page).getByRole('button', { name: 'Retry exact correction', exact: true }).click();
  const result = await response; expect(result.request().postDataJSON()).toEqual(original);
  expect((await result.json()).result.replayed).toBe(true);
  expect((await db.collection('parentCorrectionEvents').where('parent_id', '==', fixture.parentId).get()).size).toBe(1);
});

test('a live status change requires parent review and cannot silently flip a drafted correction', async ({ page }) => {
  await reset(); await parent(page); await select(page);
  await region(page).getByLabel('Reason (required)').fill('Preparing my parent correction');
  const state = ok(await call('getStudentSchoolState', directionStudentContext(student))); const block = state.weekly_plan.blocks.find((item) => !item.require_timer);
  const token = await signInDirectionParent(fixture);
  ok(await call('correctSchoolBlock', { student_id: student.id, week_key: state.week_key, weekly_block_id: block.id,
    expected_revision: 0, new_status: 'completed', reason: 'Other parent device', note: '', idempotency_key: 'browser-race-other' }, token));
  await expect(region(page).getByRole('button', { name: 'Reload and review', exact: true })).toBeVisible();
  await expect(region(page).getByRole('button', { name: 'Mark complete as parent correction', exact: true })).toBeDisabled();
  expect((await db.collection('parentCorrectionEvents').where('parent_id', '==', fixture.parentId).get()).size).toBe(1);
  await region(page).getByRole('button', { name: 'Reload and review', exact: true }).click();
  await select(page, /Subject 2 block.*1.*Complete/);
  await expect(region(page).getByLabel('Reason (required)')).toHaveValue('');
});

test('first publication reconciles an existing private draft with frozen legacy completion explicitly', async ({ page, browser }) => {
  await reset(); await db.collection('weeklyPlans').doc(initial.id).delete();
  await db.collection('weeklyPlanDrafts').doc(initial.id).update({ base_published_revision: 0 });
  const state = ok(await call('getStudentSchoolState', directionStudentContext(student))); const block = state.weekly_plan.blocks[0];
  const token = await signInDirectionParent(fixture);
  ok(await call('correctSchoolBlock', { student_id: student.id, week_key: state.week_key, weekly_block_id: block.id,
    expected_revision: 0, new_status: 'completed', reason: 'Legacy practice observed', note: '', idempotency_key: 'browser-bridge-before' }, token));
  await parent(page);
  const reconcile = page.getByRole('region', { name: 'Legacy completion reconciliation' });
  await expect(reconcile).toBeVisible();
  await reconcile.getByRole('combobox').selectOption(block.id);
  page.once('dialog', (dialog) => dialog.accept());
  const response = responseTo(page, 'publishWeeklyPlan');
  await page.getByRole('button', { name: 'Publish This Week', exact: true }).click();
  ok(await (await response).json());
  const context = await browser.newContext(); const second = await context.newPage(); await portal(second);
  await expect(second.getByRole('button', { name: /Subject 1.*1 of 1 blocks complete/ })).toBeVisible();
  expect((await read('schoolPublicationBridges', initial.id)).legacy_source_links[initial.data.blocks[0].id]).toBe(block.id);
  expect((await db.collection('parentCorrectionEvents').where('parent_id', '==', fixture.parentId).get()).size).toBe(1);
  await context.close();
});

test('a new report filing intent can restore a deliberately deleted unamended original', async ({ page }) => {
  await reset(); await parent(page); await page.goto('/dashboard/reports');
  page.on('dialog', (dialog) => dialog.accept());
  const manualResponse = () => page.waitForResponse((response) => response.url().endsWith('/fileSchoolWeeklyReport')
    && response.request().method() === 'POST' && response.request().postDataJSON()?.data?.student_id === student.id
    && response.request().postDataJSON()?.data?.source === 'manual');
  const first = manualResponse();
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  const firstResponse = await first; const firstPayload = firstResponse.request().postDataJSON(); ok(await firstResponse.json());
  await expect.poll(async () => Boolean(await read('weeklyReports', initial.id))).toBe(true);
  await expect(page.getByRole('button', { name: 'Save record', exact: true })).toBeEnabled();
  await page.locator('.op-report-record-row').filter({ hasText: student.name }).getByTitle('Delete', { exact: true }).click();
  await expect.poll(async () => await read('weeklyReports', initial.id)).toBeUndefined();
  const second = manualResponse();
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  const secondResponse = await second; expect(secondResponse.request().postDataJSON().data.idempotency_key).not.toBe(firstPayload.data.idempotency_key);
  expect((await secondResponse.json()).result.created).toBe(true);
  await expect.poll(async () => Boolean(await read('weeklyReports', initial.id))).toBe(true);
});

test('parent correction remains usable with keyboard on a small screen', async ({ page }) => {
  await reset(); await page.setViewportSize({ width: 390, height: 844 }); await parent(page); await select(page);
  await region(page).getByLabel('Reason (required)').fill('Observed reading on mobile');
  await page.keyboard.press('Tab'); await expect(region(page).getByLabel('Parent note (optional)')).toBeFocused();
  await region(page).getByLabel('Parent note (optional)').fill('Keyboard and touch controls are reachable.');
  await save(page, 'Mark complete as parent correction');
  await expect(region(page).getByRole('button', { name: /Subject 2 block.*1.*Complete/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await region(page).screenshot({ path: 'tmp/product-direction/browser-correction-mobile.png' });
});

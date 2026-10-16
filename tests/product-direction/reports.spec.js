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
const fixture = buildDirectionFixture({ scenario: 'corrections' });
const student = fixture.students[0];
const secondStudent = fixture.students[1];
const initial = fixture.documents.find((item) => item.collection === 'weeklyPlans' && item.data.student_id === student.id);
const attack = '<script>window.__reportInjected = true</script><img src=x onerror="window.__reportInjected = true"> & "quoted"';
const reflection = `Original student reflection: ${attack}\n${'I explained my reasoning and checked each step against the example. '.repeat(32)}\nFinal preserved reflection line.`;
const resourceUrl = `https://example.test/evidence/${'long-reference-'.repeat(35)}`;
const correctionReason = 'Reopen for a second worked example';
const correctionNote = `Parent review note remains separate from student evidence. ${attack}`;
const read = async (collection, id) => (await db.collection(collection).doc(id).get()).data();
const ok = (body) => { expect(body.result, JSON.stringify(body)).toBeTruthy(); return body.result; };
const article = (page, name = student.name) => page.getByRole('article', { name: `Official record for ${name}`, exact: true });
const totals = (scope) => scope.getByRole('group', { name: 'Weekly completion totals', exact: true });
const parent = async (page) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(fixture.auth.email);
  await page.locator('input[type="password"]').fill(fixture.auth.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/dashboard/reports');
  await expect(page.getByRole('button', { name: 'Show records', exact: true })).toBeVisible();
};
const records = async (page) => page.getByRole('button', { name: 'Show records', exact: true }).click();
const stubPrint = async (context) => context.addInitScript(() => {
  // Runs before any popup document executes; browser print dialogs cannot stall QA.
  window.__reportPrintCalls = 0;
  Object.defineProperty(window, 'print', { configurable: false, writable: false, value: () => { window.__reportPrintCalls += 1; } });
});
const printed = async (page, button) => {
  const opened = page.waitForEvent('popup');
  await button.click();
  const popup = await opened;
  await popup.waitForLoadState('domcontentloaded');
  await expect.poll(() => popup.evaluate(() => window.__reportPrintCalls)).toBe(1);
  expect(await popup.evaluate(() => window.__reportInjected)).toBeUndefined();
  await expect(popup.locator('script, img')).toHaveCount(0);
  return popup;
};
const prepare = async ({ undo = true, secondReport = false, longName = false } = {}) => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=corrections', '--write'], { env: process.env });
  const plan = await read('weeklyPlans', initial.id);
  const selected = plan.blocks.find((block) => !block.require_timer);
  const blocks = plan.blocks.map((block) => block.id === selected.id ? { ...block, require_input: true,
    custom_fields: [{ id: 'explanation', type: 'text', label: 'Explain your steps', required: true }],
    resources: [{ name: `Worked example ${attack}`, url: resourceUrl }],
  } : block);
  await db.collection('weeklyPlans').doc(initial.id).update({ blocks });
  const name = longName ? `Avery ${'Alexandra Long Student Name '.repeat(5).trim()}` : student.name;
  if (longName) await db.collection('students').doc(student.id).update({ name });
  const state = ok(await call('getStudentSchoolState', directionStudentContext(student)));
  const submission = ok(await call('submitSchoolBlock', { ...directionStudentContext(student), week_key: state.week_key,
    weekly_block_id: selected.id, expected_revision: 0, idempotency_key: 'reports-browser-evidence', summary_text: reflection,
    resources_used: [0], custom_field_responses: { explanation: `A separate custom response ${attack}` } }));
  const token = await signInDirectionParent(fixture);
  ok(await call('fileSchoolWeeklyReport', { student_id: student.id, week_key: state.week_key, source: 'manual', idempotency_key: 'reports-browser-original' }, token));
  const original = await read('weeklyReports', initial.id);
  const evidence = await read('submissions', submission.submission_id);
  if (secondReport) {
    const second = ok(await call('getStudentSchoolState', directionStudentContext(secondStudent)));
    ok(await call('fileSchoolWeeklyReport', { student_id: secondStudent.id, week_key: second.week_key, source: 'manual', idempotency_key: 'reports-browser-second' }, token));
  }
  if (undo) {
    const latest = ok(await call('getStudentSchoolState', directionStudentContext(student)));
    const current = latest.blocks.find((block) => block.weekly_block_id === selected.id);
    ok(await call('correctSchoolBlock', { student_id: student.id, week_key: state.week_key, weekly_block_id: selected.id,
      expected_revision: current.revision, new_status: 'incomplete', reason: correctionReason, note: correctionNote,
      idempotency_key: 'reports-browser-undo' }, token));
  }
  return { original, evidence, submissionId: submission.submission_id, selected, name };
};

test('saved original and amendment match popup totals while undo preserves escaped student evidence and resources', async ({ page, context }) => {
  await stubPrint(context);
  const prepared = await prepare();
  await parent(page); await records(page);
  const record = article(page);
  await expect(record.getByText(`${prepared.original.weekly_goal} assigned · 1 completed · ${prepared.original.weekly_goal - 1} incomplete`, { exact: true })).toBeVisible();
  await record.getByLabel('Report version').selectOption({ label: 'Amendment · Version 2' });
  await record.getByRole('button', { name: 'Details & corrections', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Official report details' });
  await expect(dialog.getByLabel('Report version')).toHaveValue(/report-amendment/);
  await expect(totals(dialog).getByText('0 completed', { exact: true })).toBeVisible();
  const originalResponses = dialog.getByRole('region', { name: 'Original evidence', exact: true });
  await originalResponses.getByText(/Original responses \(1\)/).click();
  await expect(originalResponses.getByText(reflection, { exact: true })).toBeVisible();
  await expect(originalResponses.getByText(resourceUrl, { exact: false })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Report corrections and notes' }).getByText(`Reason: ${correctionReason}`, { exact: true })).toBeVisible();
  const amended = await printed(page, dialog.getByRole('button', { name: 'Print selected version', exact: true }));
  await expect(amended.locator('.version')).toHaveText(/Amendment · Version 2/);
  await expect(amended.locator('.counts')).toContainText('0 completed');
  await expect(amended.locator('.counts')).toContainText(`${prepared.original.weekly_goal} incomplete`);
  await expect(amended.locator('body')).toContainText(reflection);
  await expect(amended.locator('body')).toContainText(resourceUrl);
  await expect(amended.locator('.correction')).toContainText(correctionReason);
  await expect(amended.locator('.correction')).toContainText(correctionNote);
  await expect(amended.locator('body')).toContainText(`Evidence ref: ${prepared.submissionId}`);
  await expect(amended.locator('body')).toContainText('0 recorded min');
  await amended.close();
  await dialog.getByLabel('Report version').selectOption(initial.id);
  await expect(totals(dialog).getByText('1 completed', { exact: true })).toBeVisible();
  const original = await printed(page, dialog.getByRole('button', { name: 'Print selected version', exact: true }));
  await expect(original.locator('.version')).toHaveText(/Original saved report · Version 1/);
  await expect(original.locator('.counts')).toContainText('1 completed');
  await expect(original.locator('.correction')).toHaveCount(0);
  await expect(original.locator('body')).toContainText(reflection);
  await original.close();
  expect(await read('weeklyReports', initial.id)).toEqual(prepared.original);
  expect(await read('submissions', prepared.submissionId)).toEqual(prepared.evidence);
});

test('student and subject filters select complete weekly snapshots in live and saved print output', async ({ page, context }) => {
  await stubPrint(context);
  const prepared = await prepare({ undo: false, secondReport: true });
  await parent(page); await records(page);
  await expect(page.getByRole('article', { name: /Official record for/ })).toHaveCount(2);
  // Subject 1 belongs only to the first student. Matching retains their other subjects.
  await page.getByRole('button', { name: 'Subject 1', exact: true }).click();
  await expect(page.getByRole('article', { name: /Official record for/ })).toHaveCount(1);
  const record = article(page);
  await expect(record.getByText(`${prepared.original.weekly_goal} assigned · 1 completed · ${prepared.original.weekly_goal - 1} incomplete`, { exact: true })).toBeVisible();
  const filtered = await printed(page, page.getByRole('button', { name: 'Print filtered', exact: true }).first());
  await expect(filtered.locator('.student-section')).toHaveCount(1);
  await expect(filtered.locator('.counts')).toContainText(`${prepared.original.weekly_goal} assigned`);
  await expect(filtered.locator('body')).toContainText('Subject 2');
  await expect(filtered.locator('body')).toContainText('Subject 3');
  await expect(filtered.locator('body')).toContainText(reflection);
  await filtered.close();
  await page.getByRole('button', { name: 'Subject 1', exact: true }).click();
  await page.getByRole('button', { name: student.name, exact: true }).click();
  await expect(page.getByRole('article', { name: /Official record for/ })).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Weekly completion totals' })).toHaveCount(1);
  const live = await printed(page, page.getByRole('button', { name: 'Print report', exact: true }));
  await expect(live.locator('.student-section')).toHaveCount(1);
  await expect(live.locator('.version')).toHaveText('Live weekly view');
  await expect(live.locator('.counts')).toContainText(`${prepared.original.weekly_goal} assigned`);
  await expect(live.locator('.counts')).toContainText('1 completed');
  await expect(live.locator('body')).toContainText(reflection);
  await live.close();
});

test('long saved report remains stable after curriculum edits and its mobile version dialog supports keyboard without overflow', async ({ page }) => {
  const prepared = await prepare({ longName: true });
  await db.collection('subjects').doc(prepared.selected.legacy_subject_id).update({ title: 'A later curriculum edit must not rewrite saved evidence' });
  await page.setViewportSize({ width: 390, height: 844 });
  await parent(page); await records(page);
  const record = article(page, prepared.name);
  const open = record.getByRole('button', { name: 'Details & corrections', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Official report details' });
  const close = dialog.getByRole('button', { name: 'Close report details', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await dialog.getByLabel('Report version').focus();
  await expect(dialog.getByLabel('Report version')).toBeFocused();
  // Native popup key handling differs in headless macOS Chromium. Exercise
  // focus trapping with real keys above, then select the native option directly.
  await dialog.getByLabel('Report version').selectOption({ label: 'Amendment · Version 2' });
  await expect(totals(dialog).getByText('0 completed', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Assigned work', exact: true })).toContainText(prepared.selected.legacy_subject_title);
  await expect(dialog.getByRole('region', { name: 'Original evidence', exact: true })).not.toContainText('A later curriculum edit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.screenshot({ path: 'tmp/product-direction/browser-reports-mobile-versions.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(await read('weeklyReports', initial.id)).toEqual(prepared.original);
});

test('legacy review print preserves original responses and reports unknown duration without claiming a corrected total', async ({ page, context }) => {
  await stubPrint(context);
  const prepared = await prepare({ undo: false });
  // Admin insertion is an emulator-only compatibility fixture, matching old saved
  // records that predate assignment identities and trusted duration attribution.
  const id = `${fixture.parentId}_browser_legacy_unknown`;
  const legacy = { ...prepared.original, id, original_report_id: id, student_name: 'Legacy browser record', snapshot_model: 'subjects', weekly_plan_id: '',
    assigned_blocks_snapshot: [], total_blocks: 1, weekly_goal: 8, total_hours: 0, total_minutes: 0,
    subjects_data: { history: { subjectId: 'history', subjectTitle: 'Historical subject', totalBlocks: 1, goalBlocks: 8, totalMinutes: 0,
      summaries: [{ text: `Original legacy response ${attack}`, blockNumber: 1, date: null, duration: null, manualOverride: true }] } },
    subject_ids: ['history'], subject_titles: ['Historical subject'], correction_events: [] };
  await db.collection('weeklyReports').doc(id).set(legacy);
  const amendmentId = `${id}_amendment`;
  await db.collection('weeklyReportAmendments').doc(amendmentId).set({ parent_id: fixture.parentId, student_id: student.id,
    original_report_id: id, previous_report_version_id: id, report_version: 2, actor_id: fixture.parentId, recorded_at: prepared.original.created_at,
    correction_event_ids: ['legacy-correction-reference'], snapshot: { ...legacy, completion_counts_require_review: true,
      block_completion_overrides: { historical: { block_index: 0, status: 'incomplete', revision: 1, provenance: 'parent_correction' } } } });
  await parent(page); await records(page);
  const record = article(page, legacy.student_name);
  await record.getByLabel('Report version').selectOption(amendmentId);
  await expect(record.getByText('Duration not recorded', { exact: true })).toBeVisible();
  const popup = await printed(page, record.getByRole('button', { name: 'Print selected version', exact: true }));
  await expect(popup.locator('body')).toContainText('Completion counts require review');
  await expect(popup.locator('body')).toContainText('no corrected total is claimed');
  await expect(popup.locator('body')).toContainText('Duration not recorded');
  await expect(popup.locator('body')).toContainText('Legacy parent record (actor not recorded)');
  await expect(popup.locator('body')).toContainText('Original legacy response');
  await expect(popup.locator('body')).toContainText('legacy-correction-reference');
  await expect(popup.locator('.version')).toHaveText(/Amendment · Version 2/);
  await popup.close();
});

test('archived original and amendment retain frozen week boundaries after a household reset change, including live print', async ({ page, context }) => {
  await stubPrint(context);
  const prepared = await prepare();
  const amendments = await db.collection('weeklyReportAmendments').where('original_report_id', '==', initial.id).get();
  expect(amendments.size).toBe(1);
  const amendment = amendments.docs[0];
  const amendmentBefore = amendment.data();
  const date = (value, dateOnly = false) => new Intl.DateTimeFormat('en-US', { timeZone: prepared.original.timezone,
    year: 'numeric', month: 'short', day: 'numeric', ...(dateOnly ? {} : { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  }).format(value.toDate());
  const frozenRange = `${date(prepared.original.week_start)} – ${date(prepared.original.week_end)}`;
  const frozenDays = `${date(prepared.original.week_start, true)} – ${date(prepared.original.week_end, true)}`;
  // Keep the same Monday week key while moving the newly configured boundary
  // seven and a half hours. The filed calendar and assignments stay immutable.
  await db.collection('weeklyPlans').doc(initial.id).update({ status: 'archived', archived_at: new Date() });
  await db.collection('parents').doc(fixture.parentId).update({ week_reset_hour: 7, week_reset_minute: 30 });
  await parent(page);
  await page.getByRole('button', { name: student.name, exact: true }).click();
  await records(page);
  const record = article(page);
  await expect(record.getByText(frozenDays, { exact: true })).toBeVisible();
  await record.getByRole('button', { name: 'Details & corrections', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Official report details' });
  await expect(dialog.getByText(frozenDays, { exact: true })).toBeVisible();
  await expect(totals(dialog).getByText('1 completed', { exact: true })).toBeVisible();
  let popup = await printed(page, dialog.getByRole('button', { name: 'Print selected version', exact: true }));
  await expect(popup.locator('.week')).toHaveText(frozenRange);
  await expect(popup.locator('.version')).toHaveText(/Original saved report · Version 1/);
  await expect(popup.locator('body')).toContainText(reflection);
  await popup.close();
  await dialog.getByLabel('Report version').selectOption(amendment.id);
  await expect(totals(dialog).getByText('0 completed', { exact: true })).toBeVisible();
  popup = await printed(page, dialog.getByRole('button', { name: 'Print selected version', exact: true }));
  await expect(popup.locator('.week')).toHaveText(frozenRange);
  await expect(popup.locator('.version')).toHaveText(/Amendment · Version 2/);
  await expect(popup.locator('body')).toContainText(reflection);
  await expect(popup.locator('body')).toContainText(correctionReason);
  await expect(popup.locator('body')).toContainText(`Evidence ref: ${prepared.submissionId}`);
  await popup.close();
  await dialog.getByRole('button', { name: 'Close report details', exact: true }).click();
  // The live view of this archived, still-addressable week must also use the
  // plan's frozen dates rather than reconstructing a range from today's reset.
  popup = await printed(page, page.getByRole('button', { name: 'Print report', exact: true }));
  await expect(popup.locator('.student-section')).toHaveCount(1);
  await expect(popup.locator('.week')).toHaveText(frozenRange);
  await expect(popup.locator('.counts')).toContainText('0 completed');
  await expect(popup.locator('body')).toContainText(reflection);
  await popup.close();
  expect(await read('weeklyReports', initial.id)).toEqual(prepared.original);
  expect(await read('weeklyReportAmendments', amendment.id)).toEqual(amendmentBefore);
  expect(await read('submissions', prepared.submissionId)).toEqual(prepared.evidence);
  const archived = await read('weeklyPlans', initial.id);
  expect(archived.status).toBe('archived');
  expect(archived.week_start.toMillis()).toBe(prepared.original.week_start.toMillis());
  expect(archived.week_end.toMillis()).toBe(prepared.original.week_end.toMillis());
});

import assert from 'node:assert/strict';
import { getCurrentWeekRange, getWeekConfig, getWeekKey, getWeekRangeByOffset } from '../src/utils/weekUtils.js';
import { resolvePlanningWeek } from '../functions/src/weeklyPlanningContracts.js';
import { buildPublishedWeeklyPlanWorkLauncherContract } from '../src/utils/workLauncherUtils.js';
import { buildStudentWeeklySnapshot, buildWeeklyReportPayload } from '../src/utils/reportUtils.js';

const cases = [
  ['2026-03-03T18:00Z', { timezone: 'America/Chicago' }],
  ['2026-10-28T18:00Z', { timezone: 'America/Chicago' }],
  ['2026-10-14T19:29:59Z', { timezone: 'America/Chicago', week_reset_day: 3, week_reset_hour: 14, week_reset_minute: 30 }],
  ['2026-10-14T19:30:00Z', { timezone: 'America/Chicago', week_reset_day: 3, week_reset_hour: 14, week_reset_minute: 30 }],
  ['2026-03-08T08:00Z', { timezone: 'America/Chicago', week_reset_day: 0, week_reset_hour: 2, week_reset_minute: 30 }],
  ['2026-11-01T07:15Z', { timezone: 'America/Chicago', week_reset_day: 0, week_reset_hour: 1, week_reset_minute: 30 }],
  ['2026-11-01T06:29Z', { timezone: 'America/Chicago', week_reset_day: 0, week_reset_hour: 1, week_reset_minute: 30 }],
  ['2026-10-14T23:30Z', { timezone: 'Pacific/Kiritimati', week_reset_day: 4, week_reset_hour: 13 }],
];
for (const [instant, settings] of cases) {
  const now = new Date(instant);
  const range = getCurrentWeekRange(now, settings);
  const normalized = getCurrentWeekRange(now, getWeekConfig(settings));
  assert.deepEqual(normalized, range, 'Normalized settings preserve custom reset/timezone');
  const key = getWeekKey(range.weekStart, settings);
  const server = resolvePlanningWeek({ weekKey: key, settings, now });
  assert.equal(key, server.currentKey);
  assert.equal(range.weekStart.getTime(), server.weekStart.getTime());
  assert.equal(range.weekEnd.getTime(), server.weekEnd.getTime());
}
const NativeDate = globalThis.Date;
try {
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : ['2026-10-14T18:00Z'])); } };
  assert.equal(getWeekKey(getWeekRangeByOffset(3, { timezone: 'America/Chicago' }).weekStart, { timezone: 'America/Chicago' }), '2026-11-02');
} finally { globalThis.Date = NativeDate; }

const student = { id: 's', parent_id: 'p', weekly_planning_version: 1 };
const subject = { id: 'math', student_ids: ['s'], is_active: true, block_count: 2, block_length: 30, title: 'Math' };
for (const weeklyPlan of [null, { id: 'p_s_week', status: 'published', blocks: [] }, { id: 'p_s_week', status: 'archived', blocks: [] }]) {
  const contract = buildPublishedWeeklyPlanWorkLauncherContract({ studentRecord: student, subjectsById: { math: subject }, weeklyPlan });
  assert.equal(contract.uses_weekly_plan_authority, true);
  assert.equal(contract.blocks.length, 0, 'Adopted empty/missing/archived weeks never regenerate live subject work');
  assert.equal(contract.bridge_subjects.length, 0);
}
const legacyStudent = { id: 's', parent_id: 'p' };
assert.equal(buildPublishedWeeklyPlanWorkLauncherContract({ studentRecord: legacyStudent, subjectsById: { math: subject } }).blocks.length, 2);
const reportArgs = { student, subjects: [subject], submissions: [], weekStart: new Date('2026-10-12T05:00Z'), weekEnd: new Date('2026-10-19T04:59:59Z') };
assert.equal(buildStudentWeeklySnapshot(reportArgs).goalBlocks, 0);
assert.equal(buildStudentWeeklySnapshot({ ...reportArgs, weeklyPlan: { id: 'private', status: 'draft', blocks: [] } }).goalBlocks, 0);
assert.equal(buildStudentWeeklySnapshot({ ...reportArgs, student: { ...student, weekly_planning_adopted_at: new Date('2026-10-20T05:00Z') } }).goalBlocks, 2, 'Pre-adoption subject history remains reportable');
console.log('Weekly authority readers: calendar parity, DST picker, empty/missing authority and historical report checks passed.');

const tokyoSettings = { timezone: 'Asia/Tokyo' };
const tokyoRange = getCurrentWeekRange(new Date('2026-10-13T03:00Z'), tokyoSettings);
const tokyoReport = buildWeeklyReportPayload({ student, snapshot: buildStudentWeeklySnapshot({ ...reportArgs, ...tokyoRange }),
  ...tokyoRange, parentId: 'p', parentSettings: tokyoSettings, source: 'manual' });
assert.equal(tokyoReport.week_key, '2026-10-12', 'Report payload and plan/document identity use household-local date');

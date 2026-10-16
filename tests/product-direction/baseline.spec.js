import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildDirectionFixture } from '../../scripts/product-direction-fixtures.mjs';

const fixture = buildDirectionFixture({ scenario: 'single' });

// Each browser file owns its fixture reset, so standalone/repeated runs remain valid.
test.beforeAll(async () => {
  await promisify(execFile)(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--scenario=single', '--write'], { env: process.env });
});

test('seeded parent login reaches dashboard and current student', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(fixture.auth.email);
  await page.locator('input[type="password"]').fill(fixture.auth.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(fixture.students[0].name, { exact: true }).first()).toBeVisible();
});

test('PIN portal reads published school work and persisted routine state', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/student/${fixture.students[0].slug}`);
  await page.getByLabel('Student PIN').fill(fixture.students[0].access_pin);
  await page.getByRole('button', { name: /enter|continue|unlock/i }).click();
  await expect(page.getByRole('button', { name: 'School', exact: true })).toBeVisible();
  await expect(page.getByText('Subject 1', { exact: true }).first()).toBeVisible();
  await page.getByTestId('student-portal-chores-tab').click();
  await expect(page.getByText('morning routine', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Complete this routine').first()).toBeVisible();
  const morning = page.locator('article').filter({ hasText: 'morning routine' });
  await morning.getByText('Complete this routine', { exact: true }).click();
  await expect(morning.getByRole('checkbox')).toBeChecked();
  const saved = page.waitForResponse((response) => response.url().endsWith('/completeRoutine') && response.request().method() === 'POST');
  await morning.getByRole('button', { name: 'Complete routine', exact: true }).click();
  const persisted = (await (await saved).json()).result;
  expect(persisted.routine_completion_id).toContain(fixture.students[0].id);
  await expect(morning.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByLabel('Student PIN').fill(fixture.students[0].access_pin);
  await page.getByRole('button', { name: 'Enter portal', exact: true }).click();
  await page.getByTestId('student-portal-chores-tab').click();
  await expect(page.locator('article').filter({ hasText: 'morning routine' }).getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'tmp/product-direction/browser-routine-persisted.png', fullPage: true });
  expect(errors).toEqual([]);
});

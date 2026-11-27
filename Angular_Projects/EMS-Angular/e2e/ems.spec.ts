import { expect, test } from '@playwright/test';
import { creds, futureWeekday, login, logout, pickOption } from './helpers';

/**
 * End-to-end journeys against the REAL Express backend (isolated *_test database, seeded by e2e/seed.mjs).
 * Tests run serially and share state (an employee created in step 3 is edited in step 5).
 */
test.describe.configure({ mode: 'serial' });

const unique = Date.now().toString().slice(-7);
const newEmployee = { first: 'Nora', last: `E2E${unique}`, email: `nora.e2e${unique}@ems.test` };
const leaveReason = `E2E leave ${unique}`;

test.beforeAll(() => {
  if (!creds.admin.email || !creds.admin.password) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (see README → E2E tests)');
});

test('1. login: bad credentials are rejected, good credentials open the app', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(creds.admin.email);
  await page.getByTestId('login-password').fill('definitely-wrong');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText(/invalid email or password/i);
  await login(page, creds.admin);
});

test('2. dashboard shows database-backed statistics', async ({ page }) => {
  await login(page, creds.admin);
  await expect(page.getByTestId('stat-total')).toBeVisible();
  const total = Number((await page.getByTestId('stat-total').locator('.value').innerText()).trim());
  expect(total).toBeGreaterThanOrEqual(6);
  await expect(page.getByText('Headcount by department')).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('3. HR creates an employee with education and experience rows', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees/new');
  await page.getByTestId('firstName').fill(newEmployee.first);
  await page.getByTestId('lastName').fill(newEmployee.last);
  await page.getByTestId('workEmail').fill(newEmployee.email);
  await page.getByTestId('joiningDate').fill('2025-03-03');
  await pickOption(page, 'departmentId', 'Engineering');
  await pickOption(page, 'designationId', /Software Engineer/);

  // FormArray: dynamic rows with independent validation
  await page.getByTestId('add-education').click();
  await page.getByTestId('add-education').click();
  await expect(page.locator('[data-testid^="edu-row-"]')).toHaveCount(2);
  await page.getByTestId('edu-row-0').getByLabel('Institution').fill('State University');
  await page.getByTestId('edu-row-0').getByLabel('Degree').fill('BSc Computer Science');
  await page.getByRole('button', { name: 'Remove education 2' }).click(); // second row removed
  await expect(page.locator('[data-testid^="edu-row-"]')).toHaveCount(1);
  await page.getByTestId('add-experience').click();
  await page.getByTestId('exp-row-0').getByLabel('Company').fill('Acme Corp');
  await page.getByTestId('exp-row-0').getByLabel('Role', { exact: true }).fill('Developer');
  await page.getByTestId('exp-row-0').getByLabel('Start date').fill('2020-01-01');
  await page.getByTestId('exp-row-0').getByLabel('End date').fill('2024-12-31');

  await page.getByTestId('save-employee').click();
  await expect(page).toHaveURL(/\/employees\/\d+\/overview/, { timeout: 20_000 });
  await expect(page.getByTestId('employee-name')).toContainText(`${newEmployee.first} ${newEmployee.last}`);
  // Education/experience are browser-local (the backend has no API for them), so verify in the same browser context.
  await page.getByTestId('tab-background').click();
  await expect(page.getByText('BSc Computer Science')).toBeVisible();
  await expect(page.getByText('Acme Corp')).toBeVisible();
});

test('3b. validation: required fields and duplicate e-mail are reported before saving', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees/new');
  await page.getByTestId('save-employee').click();
  await expect(page.getByText('First name is required')).toBeVisible();
  await page.getByTestId('firstName').fill('Dup');
  await page.getByTestId('lastName').fill('Licate');
  await page.getByTestId('workEmail').fill(newEmployee.email); // already created in step 3
  await page.getByTestId('joiningDate').click();
  await expect(page.getByText('This email is already in use')).toBeVisible({ timeout: 10_000 });
});

test('4. view employee details and the job history tab', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees');
  await page.getByTestId('search-input').fill(newEmployee.last);
  const row = page.getByRole('row', { name: new RegExp(newEmployee.last) });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: new RegExp(newEmployee.first) }).click();
  await expect(page.getByTestId('employee-name')).toContainText(newEmployee.last);
  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('job-history')).toContainText('JOINED');
});

test('5. edit employee information', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees');
  await page.getByTestId('search-input').fill(newEmployee.last);
  await page.getByRole('row', { name: new RegExp(newEmployee.last) }).getByRole('link', { name: new RegExp(newEmployee.first) }).click();
  await page.getByTestId('edit-employee').click();
  await expect(page).toHaveURL(/\/edit$/);
  const jobTitle = page.getByLabel('Job title');
  await jobTitle.fill('Senior QA Engineer');
  await page.getByTestId('save-employee').click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 20_000 });
  await expect(page.getByTestId('employee-name')).toBeVisible();
  await expect(page.getByText('Senior QA Engineer').first()).toBeVisible();
});

test('6. search and filter employees (state kept in the URL)', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees');
  await page.getByTestId('search-input').fill('Eve');
  await expect(page).toHaveURL(/q=Eve/);
  await expect(page.getByRole('row', { name: /Eve Engineer/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Hannah/ })).toHaveCount(0);
  await pickOption(page, 'filter-department', 'Sales');
  await expect(page).toHaveURL(/departmentId=\d+/);
  await expect(page.getByText('No employees match')).toBeVisible();
  // the URL is shareable: reload keeps the filters
  await page.reload();
  await expect(page.getByTestId('search-input')).toHaveValue('Eve');
});

test('7. employee applies for leave', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/leaves/apply');
  await pickOption(page, 'leave-type', 'Casual Leave');
  await expect(page.getByTestId('leave-balance-hint')).toContainText('Available');
  const start = futureWeekday(40 + (Number(unique) % 300)); // varies per run: the backend rejects overlapping requests
  await page.getByTestId('leave-start').fill(start);
  await page.getByTestId('leave-end').fill(start);
  await page.getByTestId('leave-reason').fill(leaveReason);
  await page.getByTestId('leave-submit').click();
  await expect(page).toHaveURL(/\/leaves\/\d+$/, { timeout: 20_000 });
  await expect(page.getByText('Awaiting approval')).toBeVisible();
  await expect(page.getByText(leaveReason)).toBeVisible();
});

test('8. manager approves the leave; the employee sees the decision', async ({ page }) => {
  await login(page, creds.manager);
  await page.goto('/leaves/approvals');
  const row = page.getByRole('row').filter({ hasText: leaveReason });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await page.getByTestId('reason-confirm').click();
  await expect(page.getByText('Leave approved').first()).toBeVisible();
  await logout(page);
  await login(page, creds.employee);
  await page.goto('/leaves');
  await expect(page.getByTestId('leave-table')).toContainText('Approved');
});

test('9. employee checks in and sees today in attendance', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/attendance');
  const checkIn = page.getByTestId('check-in');
  // wait for today's state to load (either the button or the "In:" line) BEFORE deciding — isVisible() alone races the render
  await expect(checkIn.or(page.getByTestId('today-card').getByText('In:'))).toBeVisible();
  if (await checkIn.isVisible()) {
    await checkIn.click();
    await expect(page.getByText('Checked in').first()).toBeVisible();
  }
  await expect(page.getByTestId('today-card')).toContainText('In:');
  await expect(page.getByTestId('attendance-table')).toContainText('Present');
  await expect(page.getByTestId('check-out')).toBeVisible();
});

test('10. organization chart is built from backend data and shows a reporting chain', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/organization');
  await expect(page.getByTestId('org-tree')).toBeVisible();
  await expect(page.getByTestId('org-tree')).toContainText('Hannah Manager');
  await page.getByRole('button', { name: /Eve Engineer/ }).click();
  await expect(page).toHaveURL(/\/organization\/\d+$/);
  await expect(page.getByTestId('org-selected-name')).toHaveText('Eve Engineer');
  await expect(page.getByTestId('org-chain')).toContainText('Hannah Manager');
});

test('11. role-based access and logout', async ({ page }) => {
  await login(page, creds.employee);
  await expect(page.getByTestId('nav-users-&-roles')).toHaveCount(0); // hidden for employees
  await page.goto('/users');
  await expect(page).toHaveURL(/\/unauthorized/);
  await page.goto('/employees/new');
  await expect(page).toHaveURL(/\/unauthorized/);
  await logout(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard/);
});

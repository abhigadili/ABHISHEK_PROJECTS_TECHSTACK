import { expect, test, type Page } from '@playwright/test';
import { USERS, apiAs, login, uniq } from './helpers';

test.describe.configure({ mode: 'serial' });
const run = uniq();
const rnd = () => Math.random().toString(36).slice(2, 7);
const STRONG = 'Chang3d!Passw0rd#1';

/** Fails a test on any uncaught page error or console error — "renders without runtime errors". */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}

test('M1. every main screen renders for HR without runtime errors', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, USERS.hr);
  const paths = ['/dashboard', '/employees', '/employees/new', '/departments', '/departments/new', '/designations', '/organization', '/attendance', '/attendance/calendar', '/leaves', '/leaves/apply', '/leaves/approvals', '/leaves/admin', '/leaves/calendar', '/holidays', '/reports', '/reports?tab=designations', '/reports?tab=joiners', '/reports?tab=leave', '/reports?tab=attendance', '/users', '/notifications', '/profile'];
  for (const p of paths) {
    const r = await page.goto(p);
    expect(r?.status(), p).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1 }).first(), p).toBeVisible();
    await expect(page.getByText('Something went wrong'), p).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('M2. designations: create, edit, deactivate', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/designations');
  await page.waitForLoadState('networkidle');
  const name = `Desig ${run}`;
  await page.getByLabel('Name').fill(name);
  await page.getByLabel(/Job level/).fill('7');
  await page.getByRole('button', { name: 'Add designation' }).click();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/edit=\d+/);
  await page.getByLabel('Name').fill(`${name} II`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${name} II`) })).toBeVisible();
  await page.getByRole('row', { name: new RegExp(`${name} II`) }).getByRole('button', { name: /Deactivate/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${name} II`) })).toContainText('Inactive');
});

test('M3. holidays: add, then delete with confirmation', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/holidays?year=2033');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Date').fill('2033-07-04');
  await page.getByLabel('Name').fill(`Holiday ${run}`);
  await page.getByRole('button', { name: 'Add holiday' }).click();
  const row = page.getByRole('row', { name: new RegExp(`Holiday ${run}`) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('row', { name: new RegExp(`Holiday ${run}`) })).toHaveCount(0);
});

test('M4. reports: tabs render and a real CSV downloads through the allow-listed handler', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/reports');
  await expect(page.getByRole('table', { name: 'Departments' })).toContainText('Engineering');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('csv-download').click()]);
  expect(dl.suggestedFilename()).toBe('departments.csv');
  const { readFile } = await import('node:fs/promises');
  expect(await readFile((await dl.path())!, 'utf8')).toContain('Engineering');
  const bad = await page.request.get('/api/reports/..%2F..%2Fusers/csv');
  expect([404, 400]).toContain(bad.status());
});

test('M5. users & roles: HR creates a login; only SUPER_ADMIN can change roles', async ({ page, browser }) => {
  await login(page, USERS.hr);
  await page.goto('/users?q=Omar');
  await page.waitForLoadState('networkidle');
  const row = page.getByRole('row', { name: /Omar Diaz/ });
  if (await row.getByRole('button', { name: 'Create login' }).count()) {
    await row.getByLabel('Initial password').fill(STRONG);
    await row.getByRole('button', { name: 'Create login' }).click();
    await expect(page.getByText('Login created')).toBeVisible();
  }
  await expect(page.getByRole('row', { name: /Omar Diaz/ })).not.toContainText('No login');
  await expect(page.getByRole('row', { name: /Omar Diaz/ }).getByRole('button', { name: 'Update' })).toHaveCount(0); // HR cannot change roles
  const sp = await (await browser.newContext()).newPage();
  await login(sp, USERS.admin);
  await sp.goto('/users?q=Omar');
  await sp.waitForLoadState('networkidle');
  await sp.getByRole('row', { name: /Omar Diaz/ }).locator('select').selectOption('MANAGER');
  await sp.getByRole('row', { name: /Omar Diaz/ }).getByRole('button', { name: 'Update' }).click();
  await expect(sp.getByText('Role updated')).toBeVisible();
});

test('M6. job history: HR records a promotion that appears in the history', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees?search=Ella');
  await page.getByTestId(/emp-link-/).first().click();
  await page.getByRole('dialog').getByRole('link', { name: /Open full profile|full profile/i }).click();
  await page.getByRole('link', { name: 'Job history' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('New job title').fill(`Senior ${run}`);
  await page.getByRole('button', { name: 'Record change' }).click();
  await expect(page.getByText('Job change recorded')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Job history' })).toContainText(`Senior ${run}`);
});

test('M7. employee deactivate / reactivate requires confirmation', async ({ page }) => {
  const admin = await apiAs(USERS.admin);
  const made = await admin('/employees', 'POST', { firstName: 'Temp', lastName: `Gone${run}`, workEmail: `temp.${run}@ems.example`, joiningDate: '2024-05-01', employmentType: 'FULL_TIME', workLocation: 'Office' });
  const id = (made.json.data as { id: number }).id;
  await login(page, USERS.hr);
  await page.goto(`/employees/${id}`);
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('employee-name')).toBeVisible();
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Employee deactivated')).toBeVisible();
  await page.getByRole('button', { name: 'Reactivate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.getByText('Employee reactivated')).toBeVisible();
});

test('M8. attendance: HR corrects a record with an audited reason', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/attendance?scope=all');
  await page.getByRole('link', { name: 'Correct' }).first().click();
  await expect(page).toHaveURL(/\/attendance\/\d+$/);
  await expect(page.getByRole('heading', { name: 'Attendance record' })).toBeVisible();
  // Next keeps the previous route's DOM alive but HIDDEN (state preservation for back navigation), and its list filter also has select[name=status]
  await page.locator('select[name=status]:visible').selectOption('HALF_DAY');
  await page.getByRole('textbox', { name: /Reason/ }).fill('E2E correction');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('Attendance corrected')).toBeVisible();
});

test('M9. leave administration: add a leave type and adjust a balance', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/leaves/admin');
  await page.waitForLoadState('networkidle');
  const code = `T${rnd().toUpperCase()}`;
  await page.getByLabel('Code').fill(code);
  await page.getByLabel(/^Name/).fill(`Type ${run}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Leave types' })).toContainText(code);
  await page.getByLabel('Employee').selectOption({ label: 'Ella Brooks' });
  await page.getByLabel('Leave type').selectOption({ label: `Type ${run}` });
  await page.getByLabel('Days (+/−)').fill('2');
  await page.getByLabel(/^Note/).fill('E2E adjustment');
  await page.getByRole('button', { name: 'Adjust' }).click();
  await expect(page.getByText('Balance adjusted')).toBeVisible();
});

test('M10. profile: edit contact details, then change password → signed out → sign in with the new password', async ({ page }) => {
  const admin = await apiAs(USERS.admin);
  const email = `pw.${run}@ems.example`;
  await admin('/employees', 'POST', { firstName: 'Pat', lastName: `Word${run}`, workEmail: email, joiningDate: '2024-05-01', employmentType: 'FULL_TIME', workLocation: 'Office', account: { role: 'EMPLOYEE', password: STRONG } });
  await login(page, { id: email, pw: STRONG });
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Phone', { exact: true }).fill('+1 555 0199');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile updated')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('+1 555 0199');
  const next = 'Newer!Passw0rd#2';
  await page.getByLabel('Current password').fill(STRONG);
  await page.getByLabel(/^New password/).fill(next);
  await page.getByLabel('Confirm new password').fill(next);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, { id: email, pw: next });
  await expect(page).toHaveURL(/\/dashboard/);
});

test('M11. forgot → reset password (dev/test token) → sign in', async ({ page }) => {
  const admin = await apiAs(USERS.admin);
  const email = `fr.${run}@ems.example`;
  await admin('/employees', 'POST', { firstName: 'Fran', lastName: `Reset${run}`, workEmail: email, joiningDate: '2024-05-01', employmentType: 'FULL_TIME', workLocation: 'Office', account: { role: 'EMPLOYEE', password: STRONG } });
  await page.goto('/forgot-password');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset instructions' }).click();
  await page.getByRole('link', { name: 'open the reset page' }).click();
  const next = 'Reset!Passw0rd#3';
  await page.getByLabel(/^New password/).fill(next);
  await page.getByLabel('Confirm password').fill(next);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, { id: email, pw: next });
  await expect(page).toHaveURL(/\/dashboard/);
});

test('M12. a MANAGER cannot reach HR-only pages but can approve', async ({ page }) => {
  await login(page, USERS.manager);
  for (const p of ['/employees/new', '/users', '/leaves/admin', '/departments/new']) { await page.goto(p); await expect(page).toHaveURL(/\/unauthorized/); }
  await page.goto('/leaves/approvals');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Leave approvals');
});

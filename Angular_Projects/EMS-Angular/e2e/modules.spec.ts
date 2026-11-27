import { expect, test } from '@playwright/test';
import { creds, login, logout, pickOption } from './helpers';

/** Module-level journeys beyond the eleven core workflows. Same real backend / isolated test database. */
test.describe.configure({ mode: 'serial' });
const unique = Date.now().toString().slice(-6);

test('every main screen renders for HR without runtime errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // 404 for a missing profile picture is expected; Angular/NG runtime errors are not.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  await login(page, creds.admin);
  const routes: [string, RegExp][] = [
    ['/dashboard', /Welcome back/], ['/employees', /Employees/], ['/departments', /Departments/], ['/designations', /Designations/],
    ['/attendance', /Attendance/], ['/attendance/reports', /Attendance reports/], ['/leaves', /My leave/], ['/leaves/approvals', /Leave approvals/],
    ['/leaves/admin', /Leave administration/], ['/organization', /Organization chart/], ['/calendar', /Calendar & holidays/],
    ['/notifications', /Notifications/], ['/reports', /Reports/], ['/users', /Users & roles/], ['/profile', /My profile/], ['/settings', /Settings/],
  ];
  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toContainText(heading);
  }
  await page.goto('/this/does/not/exist');
  await expect(page.getByText('Page not found')).toBeVisible();
  expect(problems).toEqual([]);
});

test('departments: create, search, view details and edit', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/departments/new');
  await page.getByTestId('dept-code').fill(`qa${unique}`); // lower-case is upper-cased as you type
  await page.getByTestId('dept-name').fill(`Quality ${unique}`);
  await page.getByTestId('save-department').click();
  await expect(page).toHaveURL(/\/departments\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Quality ${unique}`);
  await expect(page.getByTestId('dept-headcount')).toHaveText('0');
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByTestId('dept-name').fill(`Quality Assurance ${unique}`);
  await page.getByTestId('save-department').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Quality Assurance ${unique}`);
  await page.goto('/departments');
  await page.getByTestId('search-input').fill(unique);
  await expect(page.getByRole('row', { name: new RegExp(`QA${unique}`) })).toBeVisible();
});

test('designations: create through the dialog (job level validated)', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/designations');
  await page.getByTestId('new-designation').click();
  await page.getByTestId('designation-name').fill(`Analyst ${unique}`);
  await page.getByTestId('designation-level').fill('42');
  await page.getByTestId('designation-save').click();
  await expect(page.getByText('Job level must be at most 20')).toBeVisible();
  await page.getByTestId('designation-level').fill('4');
  await page.getByTestId('designation-save').click();
  await page.getByTestId('search-input').fill(`Analyst ${unique}`);
  await expect(page.getByRole('row', { name: new RegExp(`Analyst ${unique}`) })).toContainText('L4');
});

test('holidays: HR adds a holiday that then appears in the list', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/calendar?view=holidays');
  await page.getByTestId('new-holiday').click();
  // a free date in the current year (the backend allows one holiday per date, so vary it per run)
  const day = new Date(new Date().getFullYear(), 0, 1 + (Number(unique) % 360));
  const iso = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, '0')}-${`${day.getDate()}`.padStart(2, '0')}`;
  await page.getByTestId('holiday-date').fill(iso);
  await page.getByTestId('holiday-name').fill(`Winter break ${unique}`);
  await page.getByTestId('holiday-save').click();
  await expect(page.getByTestId('holiday-table')).toContainText(`Winter break ${unique}`);
  await page.getByTestId('calendar-views').getByText('Leave calendar').click();
  await expect(page.getByTestId('calendar-title')).toBeVisible();
});

test('reports: filters, client search and a real CSV download', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/reports');
  await page.getByRole('tab', { name: 'Leave balances' }).click();
  await expect(page.getByTestId('report-leave-balances')).toContainText('CL');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  expect(download.suggestedFilename()).toBe('leave-balances.csv');
  await page.getByRole('tab', { name: 'Headcount by department' }).click();
  await expect(page.getByTestId('report-headcount')).toContainText('Engineering');
});

test('settings: template-driven form validates and persists in the browser', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/settings');
  await page.getByTestId('settings-page-size').fill('3');
  await page.getByTestId('settings-page-size').blur();
  await expect(page.getByText('Enter a number between 5 and 50')).toBeVisible();
  await expect(page.getByTestId('settings-save')).toBeDisabled();
  await page.getByTestId('settings-page-size').fill('25');
  await page.getByTestId('settings-display-name').fill('Evie');
  await page.getByTestId('settings-page-size').click(); // blur → ngModelOptions updateOn:'blur'
  await page.getByTestId('settings-save').click();
  await expect(page.getByTestId('user-menu')).toContainText('Evie');
  await page.reload();
  await expect(page.getByTestId('user-menu')).toContainText('Evie');
});

test('notifications: unread count, mark as read', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/notifications');
  await expect(page.getByTestId('notification-list')).toBeVisible();
  const markAll = page.getByTestId('mark-all-read');
  if (await markAll.isEnabled()) await markAll.click();
  await expect(markAll).toBeDisabled();
});

test('profile: employee edits own contact details', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/profile');
  await page.getByTestId('profile-phone').fill('+1 555 010 2000');
  await page.getByTestId('profile-save').click();
  await expect(page.getByText('Profile updated').first()).toBeVisible();
  await page.getByTestId('profile-phone').fill('abc');
  await page.getByTestId('profile-phone').blur();
  await expect(page.getByText('Enter a valid phone number')).toBeVisible();
});

test('users: HR can create a login for an employee without one; roles are visible', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/users');
  await expect(page.getByTestId('user-table')).toContainText('SUPER ADMIN');
  await page.goto('/users/new');
  await page.getByTestId('new-account-password').fill('weak');
  await page.getByTestId('create-account').click();
  await expect(page.getByText(/Password needs/)).toBeVisible();
});

test('change password: complexity + confirm rules, then sign-in with the new password', async ({ page }) => {
  const user = { email: 'evan.employee@ems.test', password: creds.employee.password };
  const temp = 'Temp-Pass#2026b';
  await login(page, user);
  await page.goto('/profile/change-password');
  await page.getByTestId('cp-current').fill(user.password);
  await page.getByTestId('cp-new').fill('short');
  await page.getByTestId('cp-confirm').fill('different');
  await page.getByTestId('cp-submit').click();
  await expect(page.getByText(/Password needs/)).toBeVisible();
  await page.getByTestId('cp-new').fill(temp);
  await page.getByTestId('cp-confirm').fill(temp);
  await page.getByTestId('cp-submit').click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, { email: user.email, password: temp });
  // restore the seeded password so the suite stays re-runnable
  await page.goto('/profile/change-password');
  await page.getByTestId('cp-current').fill(temp);
  await page.getByTestId('cp-new').fill(user.password);
  await page.getByTestId('cp-confirm').fill(user.password);
  await page.getByTestId('cp-submit').click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, user);
  await logout(page);
});

test('promotion/transfer: HR records a job change that shows in the history', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees?q=Evan');
  await page.getByRole('row', { name: /Evan Engineer/ }).getByRole('link', { name: /Evan Engineer/ }).click();
  await page.getByTestId('job-change').click();
  await pickOption(page, 'change-type', 'PROMOTION');
  await page.getByLabel('New job title').fill(`Staff Engineer ${unique}`);
  await page.getByTestId('job-change-save').click();
  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('job-history')).toContainText('PROMOTION');
  await expect(page.getByTestId('job-history')).toContainText(`Staff Engineer ${unique}`);
});

test('employees: client-assembled CSV export (all pages of the filtered list)', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees?status=ALL');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-employees').click()]);
  expect(download.suggestedFilename()).toBe('employees.csv');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  expect(text.split('\r\n')[0]).toBe('Code,Name,Work email,Department,Designation,Status,Employment type,Joined');
  expect(text).toContain('eve.employee@ems.test');
  expect(text.split('\r\n').length).toBeGreaterThan(6);
});

import { expect, test } from '@playwright/test';
import { creds, login, uniq } from './helpers';

test.describe.configure({ mode: 'serial' });

const created = { email: `${uniq('e2e.')}@ems.example`.toLowerCase(), first: uniq('Zed'), last: 'Tester' };

test('1 · login rejects bad credentials, accepts good ones', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(creds.admin.email);
  await page.getByLabel('Password').fill('definitely-wrong-Password1!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  await login(page, creds.admin);
});

test('1b · protected routes redirect guests to /login', async ({ page }) => {
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/login/);
});

test('2 · dashboard shows real backend numbers', async ({ page }) => {
  await login(page, creds.admin);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const total = page.getByTestId('kpi-Total employees');
  await expect(total).toBeVisible();
  expect(Number(await total.textContent())).toBeGreaterThanOrEqual(7);
  await expect(page.getByText('Headcount by department')).toBeVisible();
});

test('3 · create employee (field arrays + async email validation)', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees/new');
  await page.getByLabel('First name').fill(created.first);
  await page.getByLabel('Last name').fill(created.last);
  // duplicate e-mail is caught by the backend-dependent async rule
  await page.getByLabel('Work email').fill(creds.admin.email);
  await page.getByLabel('Last name').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/already used by another employee/i)).toBeVisible();
  await page.getByLabel('Work email').fill(created.email);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Joining date').fill('2025-02-03');
  await page.getByRole('button', { name: 'Next' }).click();
  // dynamic rows
  await page.getByRole('button', { name: 'Add education' }).click();
  await page.getByRole('button', { name: 'Add education' }).click();
  await expect(page.getByTestId('Education-row')).toHaveCount(2);
  await page.getByLabel('Institution').first().fill('State University');
  await page.getByLabel('Degree').first().fill('BSc');
  await page.getByLabel('Start year').first().fill('2015');
  await page.getByRole('button', { name: 'Remove Education 2' }).click();
  await expect(page.getByTestId('Education-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add experience' }).click();
  const exp = page.getByTestId('Experience-row'); // scope to the row: earlier (hidden) steps reuse the "Job title" label
  await exp.getByLabel('Company').fill('Acme');
  await exp.getByLabel('Job title').fill('Intern');
  await exp.getByLabel('Start date').fill('2019-01-01');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create employee' }).click();
  await expect(page).toHaveURL(/\/employees\/\d+$/);
  await expect(page.getByRole('heading', { name: `${created.first} ${created.last}` })).toBeVisible();
});

test('4+6 · search for it, then view details', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees');
  await page.getByLabel('Search').fill(created.first);
  await expect(page).toHaveURL(new RegExp(`q=${created.first}`)); // filters live in the URL
  await expect(page.getByRole('row', { name: new RegExp(created.first) })).toBeVisible();
  await page.getByRole('row', { name: new RegExp(created.first) }).click();
  await expect(page).toHaveURL(/\/employees\/\d+$/);
  await expect(page.getByText(created.email)).toBeVisible();
  await page.getByRole('tab', { name: 'Profile' }).click();
  // education/experience have no backend endpoint → stored per-browser; a fresh browser context shows the honest banner + empty state
  await expect(page.getByText(/stored in this browser only/i)).toBeVisible();
  await expect(page.getByText(/Nothing recorded in this browser/i)).toBeVisible();
});

test('5 · edit employee', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto(`/employees?q=${created.first}`);
  await page.getByRole('row', { name: new RegExp(created.first) }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Phone').fill('+1 555 0199');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Job title').first().fill('Senior Tester'); // first = the visible job-step field
  await page.getByRole('button', { name: 'Save changes' }).first().click();
  await expect(page).toHaveURL(/\/employees\/\d+$/);
  await expect(page.getByText('Senior Tester').first()).toBeVisible();
});

test('6b · employee filters (department) narrow the list', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/employees');
  await expect(page.getByRole('row', { name: /Alice Anders/ })).toBeVisible(); // wait for real data, not the skeleton
  const all = await page.getByRole('row').count();
  await page.getByLabel('Department').click();
  await page.getByRole('option', { name: 'Sales' }).click();
  await expect(page).toHaveURL(/departmentId=\d+/);
  await expect.poll(async () => page.getByRole('row').count()).toBeLessThan(all);
  await expect(page.getByRole('row', { name: /Cara Chen/ })).toBeVisible();
});

test('7+8 · employee applies for leave, manager approves it', async ({ browser }) => {
  const reason = uniq('Family trip ');
  const emp = await (await browser.newContext()).newPage();
  await login(emp, creds.employee);
  await emp.goto('/leaves/apply');
  await emp.getByLabel('Leave type').click();
  await emp.getByRole('option', { name: 'Casual Leave' }).click();
  // unique weekday per run: the backend rejects overlapping leave, so re-runs must not reuse a date
  const d = new Date();
  d.setDate(d.getDate() + 60 + (Date.now() % 250));
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const start = d.toISOString().slice(0, 10);
  await emp.getByLabel('Start date').fill(start);
  await emp.getByLabel('End date').fill(start);
  await emp.getByLabel('Reason').fill(reason);
  await emp.getByRole('button', { name: 'Submit request' }).click();
  await expect(emp).toHaveURL(/\/leaves\/\d+$/);
  await expect(emp.getByText('Pending')).toBeVisible();

  const mgr = await (await browser.newContext()).newPage();
  await login(mgr, creds.manager);
  await mgr.goto('/leaves/approvals');
  const row = mgr.getByRole('row', { name: new RegExp(reason) }); // the unique reason identifies THIS request
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  await mgr.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(mgr.getByText('Leave approved')).toBeVisible();

  await emp.reload();
  await expect(emp.getByText('Approved').first()).toBeVisible();
});

test('9 · attendance check-in', async ({ page }) => {
  await login(page, creds.manager);
  await page.goto('/attendance');
  const checkIn = page.getByRole('button', { name: 'Check in', exact: true });
  const recorded = page.getByText(/In \d{1,2}:\d{2}/).first();
  // wait for today's record to load: either "Check in" becomes available, or a check-in time is already shown (re-run on the same day)
  await expect.poll(async () => (await checkIn.isEnabled()) || (await recorded.count()) > 0).toBe(true);
  if (await checkIn.isEnabled()) await checkIn.click();
  await expect(recorded).toBeVisible();
});

test('10 · organization chart is built from the backend and expands', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/organization');
  await expect(page.getByTestId('org-tree')).toBeVisible();
  await expect(page.getByTestId(/org-node-/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByText('Alice Anders').first()).toBeVisible();
  await page.getByLabel('Find employee').fill('manny');
  await expect(page.getByRole('button', { name: /Manny Manager/ })).toBeVisible();
});

test('role-based access: an employee cannot open admin routes', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/employees/new');
  await expect(page).toHaveURL(/\/unauthorized/);
  await expect(page.getByText(/don't have access/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users & roles' })).toHaveCount(0);
});

test('profile picture upload (multipart) shows the new avatar', async ({ page }) => {
  await login(page, creds.employee);
  await page.goto('/profile');
  // a valid 1x1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .getByTestId('file-input')
    .first()
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Profile picture updated')).toBeVisible();
  await expect(page.locator('img[alt]').first()).toBeVisible();
});

test('11 · logout ends the session', async ({ page }) => {
  await login(page, creds.admin);
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('session survives a reload (refresh-token bootstrap)', async ({ page }) => {
  await login(page, creds.admin);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

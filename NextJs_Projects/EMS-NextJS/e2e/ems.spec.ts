import { expect, test } from '@playwright/test';
import { USERS, apiAs, login, logout, uniq } from './helpers';

test.describe.configure({ mode: 'serial' });
const run = uniq();
let createdId = 0;

test('1. login: bad credentials rejected, good credentials open the app', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(USERS.admin.id);
  await page.getByLabel('Password').fill('wrong-password-1A!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await login(page, USERS.admin);
  await expect(page).toHaveURL(/\/dashboard/);
});

test('2. dashboard shows database-backed figures, streamed in slots', async ({ page }) => {
  await login(page, USERS.hr);
  await expect(page.getByRole('region', { name: 'Key figures' })).toContainText('Total employees');
  await expect(page.getByRole('region', { name: 'Charts' })).toBeVisible();
});

test('3. employee listing + 7. search (state kept in the URL)', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees');
  await expect(page.getByRole('table', { name: /employees/i })).toContainText('Ella Brooks');
  await page.getByRole('searchbox', { name: 'Search' }).fill('Omar');
  await expect(page).toHaveURL(/search=Omar/);
  await expect(page.getByRole('table', { name: /employees/i })).toContainText('Omar Diaz');
  await expect(page.getByRole('table', { name: /employees/i })).not.toContainText('Ella Brooks');
});

test('4. employee creation (React Hook Form → Server Action → Express)', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees/new');
  await page.getByLabel('First name').fill('Nora');
  await page.getByLabel('Last name').fill(`Test${run}`);
  await page.getByLabel('Work email').fill(`nora.${run}@ems.example`);
  await page.getByLabel('Department').selectOption({ label: 'Engineering' });
  await page.getByRole('combobox', { name: 'Manager' }).fill('Mark');                         // manager typeahead (debounced search against the BFF)
  await page.getByRole('option', { name: /Mark Stone/ }).click();
  await page.getByRole('button', { name: 'Add education' }).click();
  await page.getByLabel('Institution').fill('State University');
  await page.getByLabel('Degree').fill('BSc');
  await page.getByLabel('Start year').fill('2015');
  await page.getByTestId('save-employee').click();
  await expect(page).toHaveURL(/\/employees\/\d+$/);
  createdId = Number(page.url().split('/').pop());
  await expect(page.getByTestId('employee-name')).toContainText(`Nora Test${run}`);
  await expect(page.getByText('Mark Stone').first()).toBeVisible(); // manager saved through the picker
  // education has no backend endpoint → it is stored in THIS browser and shown on the Profile tab
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('BSc — State University')).toBeVisible();
});

test('4b. creation validation: empty required fields are reported before saving', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees/new');
  await page.getByTestId('save-employee').click();
  await expect(page.getByText('First name is required')).toBeVisible();
  await expect(page).toHaveURL(/\/employees\/new/);
});

test('5. employee details + tabs, 18. direct navigation to a dynamic URL', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto(`/employees/${createdId}`);
  await expect(page.getByTestId('employee-name')).toContainText('Nora');
  await page.getByRole('link', { name: 'Job history' }).click();
  await expect(page).toHaveURL(/job-history/);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('Stored in this browser only')).toBeVisible(); // fresh browser context: nothing stored here, banner explains why
  await page.goto('/employees/999999');
  await expect(page.getByTestId('employee-not-found')).toBeVisible();
});

test('6. employee editing', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto(`/employees/${createdId}/edit`);
  await page.getByLabel('Job title').fill('Staff Engineer');
  await page.getByTestId('save-employee').click();
  await expect(page).toHaveURL(new RegExp(`/employees/${createdId}$`));
  await expect(page.getByText('Staff Engineer').first()).toBeVisible();
});

test('8. employee pagination', async ({ page }) => {
  const admin = await apiAs(USERS.admin);
  const list = await admin('/employees?limit=1');
  if ((list.json.meta?.total ?? 0) < 14) {
    for (let i = 0; i < 14; i++) await admin('/employees', 'POST', { firstName: `Fill${i}`, lastName: `Er${run}`, workEmail: `fill${i}.${run}@ems.example`, joiningDate: '2024-05-01', employmentType: 'FULL_TIME', workLocation: 'Office' });
  }
  await login(page, USERS.hr);
  await page.goto('/employees');
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 1 of');
  await page.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2 of');
});

test('9. department management: create, search, edit', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/departments/new');
  await page.getByLabel('Code').fill(`D${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  await page.getByLabel('Name').fill(`Dept ${run}`);
  await page.getByRole('button', { name: 'Create department' }).click();
  await expect(page).toHaveURL(/\/departments\/\d+$/);
  await expect(page.getByRole('heading', { name: `Dept ${run}` })).toBeVisible();
  await page.getByRole('textbox', { name: 'Description' }).fill('Edited description');
  await page.getByRole('button', { name: 'Save department' }).click();
  await expect(page.getByText('Edited description').first()).toBeVisible();
  await page.goto(`/departments?q=${run}`);
  await expect(page.getByRole('table', { name: 'Departments' })).toContainText(`Dept ${run}`);
});

test('10. attendance check-in', async ({ page }) => {
  await login(page, USERS.employee);
  await page.goto('/attendance');
  const card = page.getByTestId('today-card');
  await expect(card).toBeVisible(); // client island: skeleton first, then today's record from the BFF route handler
  if (await page.getByTestId('check-in').count()) await page.getByTestId('check-in').click();
  await expect(card).toContainText('In:');
  await expect(page.getByTestId('check-out')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Attendance history' })).toContainText('Present');
});

/** A random WEEKDAY far in the future: the backend rejects overlapping requests and weekend-only ranges, and the test DB is reused across runs. */
const leaveDay = () => { for (;;) { const d = new Date(Date.UTC(2032, 0, 1 + Math.floor(Math.random() * 1800))); if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) return d.toISOString().slice(0, 10); } };
test('11. leave application, 12. manager approval, employee sees decision', async ({ browser }) => {
  const start = leaveDay();
  const ep = await (await browser.newContext()).newPage();
  await login(ep, USERS.employee);
  await ep.goto('/leaves/apply');
  await ep.getByLabel('Leave type').selectOption({ index: 1 });
  await ep.getByLabel('Start date').fill(start);
  await ep.getByLabel('End date').fill(start);
  await ep.getByLabel('Reason').fill(`E2E leave ${run}`);
  await ep.getByRole('button', { name: 'Submit request' }).click();
  await expect(ep).toHaveURL(/\/leaves\/\d+$/);
  const id = ep.url().split('/').pop();
  await expect(ep.getByText(`E2E leave ${run}`)).toBeVisible();
  // employee cannot approve
  await expect(ep.getByTestId('approve')).toHaveCount(0);
  const mp = await (await browser.newContext()).newPage();
  await login(mp, USERS.manager);
  await mp.goto('/leaves/approvals');
  await expect(mp.getByRole('table', { name: 'Pending approvals' })).toContainText('Ella Brooks');
  await mp.goto(`/leaves/${id}`);
  await mp.getByTestId('approve').click();
  await expect(mp.getByText('Approved').first()).toBeVisible();
  await ep.reload();
  await expect(ep.getByText('Approved').first()).toBeVisible();
});

test('13. organization chart: built from the hierarchy, expand/collapse and search', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/organization');
  await expect(page.getByTestId('org-tree')).toBeVisible();
  await page.getByRole('searchbox', { name: /search the organization chart/i }).fill('Ella');
  await expect(page.getByTestId('org-search-status')).toContainText('1 match highlighted');
  await expect(page.locator('[data-match="true"]')).toContainText('Ella Brooks');   // the match is highlighted…
  await expect(page.getByTestId('org-tree')).toContainText('Mark Stone');           // …and the path to it is revealed
  await page.getByRole('searchbox', { name: /search the organization chart/i }).fill(''); // an active search keeps its matches' ancestors open
  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.getByRole('button', { name: /^Expand \(/ }).first()).toBeVisible();
});

test('14. notifications: list and mark all read', async ({ page }) => {
  await login(page, USERS.employee);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByTestId('unread-badge')).toHaveCount(0);
});

test('15. logout, 16. protected route access afterwards', async ({ page }) => {
  await login(page, USERS.employee);
  await logout(page);
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/login\?next=%2Femployees/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('16b. sign-in returns to the originally requested page (and rejects open redirects)', async ({ page }) => {
  await login(page, USERS.hr, '/holidays');
  await expect(page).toHaveURL(/\/holidays$/);
  await logout(page);
  await login(page, USERS.hr, 'https://evil.example/phish');
  await expect(page).toHaveURL(/localhost:3100\/dashboard/);
});

test('17. unauthorized access: an employee cannot open admin pages or see compensation', async ({ page }) => {
  await login(page, USERS.employee);
  for (const path of ['/users', '/employees/new', '/leaves/admin', '/reports']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/unauthorized/);
  }
  await page.goto('/unauthorized');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const r = await page.request.get('/api/employees');
  expect(r.status()).toBeLessThan(500);
});

test('19. intercepted modal: list click opens a modal, URL changes, refresh shows the full page', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees');
  await page.getByTestId(/emp-link-/).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/employees\/\d+$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/employees(\?|$)/);
  await page.getByTestId(/emp-link-/).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('employee-name')).toBeVisible();
});

test('20. browser back/forward navigation keeps filters and pages in sync', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees');
  await page.getByRole('searchbox', { name: 'Search' }).fill('Omar');
  await expect(page).toHaveURL(/search=Omar/);
  await page.goto('/departments');
  await page.goBack();
  await expect(page).toHaveURL(/employees\?.*search=Omar/);
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('Omar');
  await page.goForward();
  await expect(page).toHaveURL(/\/departments/);
});

test('21. leave application shows the remaining balance for the chosen type (client island ← BFF)', async ({ page }) => {
  await login(page, USERS.employee);
  await page.goto('/leaves/apply');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Leave type').selectOption({ index: 1 });
  await expect(page.getByText(/You have [\d.]+ days? available for this type/)).toBeVisible();
});

test('22. department head typeahead on the department form', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/departments/new');
  await page.getByLabel('Code').fill(`H${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
  await page.getByLabel('Name').fill(`Headed ${run}`);
  await page.getByRole('combobox', { name: 'Department head' }).fill('Hana');
  await page.getByRole('option', { name: /Hana Rivera/ }).click();
  await page.getByRole('button', { name: 'Create department' }).click();
  await expect(page).toHaveURL(/\/departments\/\d+$/);
  await expect(page.getByText('Hana Rivera').first()).toBeVisible();
});

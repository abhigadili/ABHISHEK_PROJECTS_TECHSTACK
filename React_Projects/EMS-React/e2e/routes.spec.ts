import { expect, test, type Page } from '@playwright/test';
import { creds, login } from './helpers';

/** Visit every route as a role; fail on uncaught exceptions, console errors, or unexpected API 4xx/5xx. */
const COMMON = [
  '/dashboard',
  '/employees',
  '/employees/2',
  '/employees/2/profile',
  '/employees/2/job-history',
  '/departments',
  '/departments/1',
  '/designations',
  '/organization',
  '/organization/4',
  '/attendance',
  '/attendance/calendar',
  '/leaves',
  '/leaves/apply',
  '/leaves/calendar',
  '/holidays',
  '/notifications',
  '/profile',
  '/settings',
  '/lab',
];
const ADMIN_ONLY = [
  '/employees/new',
  '/employees/2/edit',
  '/departments/new',
  '/departments/1/edit',
  '/leaves/admin',
  '/reports',
  '/attendance/reports',
  '/leaves/approvals',
  '/users',
];

function watch(page: Page, allowed: (status: number, url: string) => boolean = () => false) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400 && !allowed(r.status(), r.url()))
      problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return problems;
}

test('admin can open every screen without errors', async ({ page }) => {
  const problems = watch(page);
  await login(page, creds.admin);
  for (const path of [...COMMON, ...ADMIN_ONLY]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/this part of the page crashed|Something went wrong/i)).toHaveCount(0);
    await page.waitForLoadState('networkidle');
  }
  expect([...new Set(problems)]).toEqual([]);
});

test('manager sees manager screens; admin-only routes are blocked in the UI', async ({ page }) => {
  // the backend legitimately answers 403 for admin-only data; the UI must redirect before asking for it, so ANY 4xx is a bug
  const problems = watch(page);
  await login(page, creds.manager);
  for (const path of [
    '/dashboard',
    '/employees',
    '/leaves/approvals',
    '/attendance/reports',
    '/reports',
    '/leaves/calendar',
    '/organization',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  for (const path of ['/users', '/leaves/admin', '/employees/new', '/departments/new']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/unauthorized/);
  }
  expect([...new Set(problems)]).toEqual([]);
});

test('employee: personal dashboard, no manager/admin API calls', async ({ page }) => {
  // /dashboard is 403 for EMPLOYEE by design → the one tolerated response
  const problems = watch(page, (s, u) => s === 403 && u.endsWith('/dashboard'));
  await login(page, creds.employee);
  await expect(page.getByText('Your personal overview')).toBeVisible();
  for (const path of [
    '/employees',
    '/departments',
    '/attendance',
    '/leaves',
    '/leaves/apply',
    '/notifications',
    '/profile',
    '/holidays',
    '/organization',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  await page.goto('/reports');
  await expect(page).toHaveURL(/\/unauthorized/);
  expect([...new Set(problems)]).toEqual([]);
});

test('unknown routes show the 404 page; bad employee id goes to the route error element', async ({
  page,
}) => {
  await login(page, creds.admin);
  await page.goto('/definitely/not/a/page');
  await expect(page.getByText(/Page not found/i)).toBeVisible();
  await page.goto('/employees/999999');
  await expect(page.getByRole('heading', { name: /Not found/i })).toBeVisible();
});

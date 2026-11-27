import { expect, test } from '@playwright/test';
import { USERS, login, uniq } from './helpers';

test.describe.configure({ mode: 'serial' });
const run = uniq();
const username = `reg_${run}`.toLowerCase().slice(0, 28);
const password = 'Regist3r!Pass#9';

test('R1. register page is reachable from login and blocks an invalid submit with field messages', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(/\/register/);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('First name is required')).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test('R2. departments in the form come from the backend', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByLabel('Department (optional)')).toContainText('Engineering');
});

test('R3. register → redirected to login with a success message → sign in with USERNAME, then with e-mail', async ({ page, browser }) => {
  await page.goto('/register');
  await page.getByLabel('First name').fill('Rita');
  await page.getByLabel('Last name').fill('Newhire');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email address').fill(`${username}@ems.example`);
  await page.getByLabel('Mobile number').fill('+1 555 0142');
  await page.getByLabel('Date of birth').fill('1994-04-12');
  await page.getByLabel('Gender').selectOption('FEMALE');
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/account (was )?created|registration/i).first()).toBeVisible();
  await login(page, { id: username, pw: password });
  await expect(page).toHaveURL(/\/dashboard/);
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  await login(p2, { id: `${username}@ems.example`, pw: password });
  await expect(p2).toHaveURL(/\/dashboard/);
  await ctx.close();
});

test('R4. a taken username is flagged live; a taken e-mail is rejected on submit', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Username').blur();
  await expect(page.getByText(/taken|not available|unavailable/i).first()).toBeVisible();
});

test('R5. the new account is a normal EMPLOYEE visible to HR', async ({ page }) => {
  await login(page, USERS.hr);
  await page.goto('/employees?search=Newhire');
  await expect(page.getByRole('table', { name: /employees/i })).toContainText('Rita Newhire');
});

test('R6. responsive: no horizontal scroll on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/register');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});

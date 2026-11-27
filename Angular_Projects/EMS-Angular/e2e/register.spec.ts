import { Page, expect, test } from '@playwright/test';
import { creds, login, pickOption } from './helpers';

/** A valid 1×1 PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const uniq = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`.toLowerCase();
const PASSWORD = `Reg!${Date.now().toString(36)}Aa9`;
const user = { username: uniq('areg'), email: `${uniq('areg')}@ems.test` };

async function fillForm(page: Page, v: { username: string; email: string; password?: string; confirm?: string }): Promise<void> {
  await page.getByTestId('reg-firstName').fill('Rita');
  await page.getByTestId('reg-lastName').fill('Registered');
  await page.getByTestId('reg-username').fill(v.username);
  await page.getByTestId('reg-email').fill(v.email);
  await page.getByTestId('reg-mobile').fill('+1 555 0123');
  await page.getByTestId('reg-dob').fill('1992-04-05');
  await pickOption(page, 'reg-gender', 'Female');
  await page.getByTestId('reg-password').fill(v.password ?? PASSWORD);
  await page.getByTestId('reg-confirm').fill(v.confirm ?? v.password ?? PASSWORD);
}

test.describe.configure({ mode: 'serial' });

test('R1. registration page is reachable from login and blocks an invalid submit with field messages', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('register-link').click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByTestId('reg-submit').click();
  await expect(page.getByText('First name is required')).toBeVisible();
  await expect(page.getByText('Username is required')).toBeVisible();
  await expect(page.getByText('Gender is required')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('R2. password strength and confirm-password mismatch are flagged beside the fields', async ({ page }) => {
  await page.goto('/register');
  await page.getByTestId('reg-password').fill('weak');
  await page.getByTestId('reg-confirm').fill('different');
  await page.getByTestId('reg-submit').click();
  await expect(page.getByText(/Password needs at least 10 characters/)).toBeVisible();
  await expect(page.getByText('Values do not match')).toBeVisible();
});

test('R3. departments come from the backend', async ({ page }) => {
  await page.goto('/register');
  await page.getByTestId('reg-department').click();
  await expect(page.getByRole('option', { name: 'Engineering' })).toBeVisible();
});

test('R4. register with a picture → redirected to login with a success message → sign in with the USERNAME', async ({ page }) => {
  await page.goto('/register');
  await fillForm(page, user);
  await pickOption(page, 'reg-department', 'Engineering');
  await page.getByTestId('file-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('reg-preview')).toBeVisible();
  await page.getByTestId('reg-submit').click();

  await expect(page).toHaveURL(/\/login\?registered=/);
  await expect(page.getByTestId('registered-banner')).toContainText(user.username);
  await expect(page.getByTestId('login-email')).toHaveValue(user.username);

  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('link', { name: 'Users & Roles' })).toHaveCount(0); // least-privileged default role
});

test('R5. the registered user can also sign in with the e-mail address', async ({ page }) => {
  await login(page, { email: user.email, password: PASSWORD });
  await expect(page).toHaveURL(/\/dashboard/);
});

test('R6. a taken username is flagged by the backend check; a taken e-mail is rejected on submit', async ({ page }) => {
  await page.goto('/register');
  await page.getByTestId('reg-username').fill(user.username.toUpperCase()); // case-insensitive
  await page.getByTestId('reg-username').blur(); // Material shows errors once the field was touched
  await expect(page.getByText('This username is already taken')).toBeVisible({ timeout: 10_000 });

  await fillForm(page, { username: uniq('other'), email: user.email });
  await page.getByTestId('reg-submit').click();
  await expect(page.getByText('This email address is already registered')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('R7. a stale availability check cannot create a duplicate: the backend rejects the second username', async ({ page }) => {
  await page.route('**/auth/username-available*', (r) => r.fulfill({ json: { success: true, data: { available: true } } }));
  await page.goto('/register');
  await fillForm(page, { username: user.username, email: `${uniq('x')}@ems.test` });
  await page.getByTestId('reg-username').blur();
  await page.waitForTimeout(600);
  await page.getByTestId('reg-submit').click();
  await expect(page.getByText('This username is already taken')).toBeVisible();
});

test('R8. a network failure shows an error and the form stays usable', async ({ page }) => {
  await page.route('**/auth/register', (r) => r.abort('failed'));
  await page.goto('/register');
  await fillForm(page, { username: uniq('net'), email: `${uniq('net')}@ems.test` });
  await page.waitForTimeout(600);
  await page.getByTestId('reg-submit').click();
  await expect(page.getByTestId('register-error')).toContainText(/cannot reach the server/i);
  await expect(page.getByTestId('reg-submit')).toBeEnabled();
});

test('R9. double-clicking submit sends exactly one request', async ({ page }) => {
  let calls = 0;
  await page.route('**/auth/register', async (r) => {
    calls += 1;
    await new Promise((x) => setTimeout(x, 400));
    await r.continue();
  });
  await page.goto('/register');
  await fillForm(page, { username: uniq('dbl'), email: `${uniq('dbl')}@ems.test` });
  await page.waitForTimeout(700); // let the debounced availability check finish
  await page.getByTestId('reg-submit').dblclick();
  await expect(page).toHaveURL(/\/login\?registered=/);
  expect(calls).toBe(1);
});

test('R10. existing admin login (email + password) still works', async ({ page }) => {
  await login(page, creds.admin);
  await expect(page).toHaveURL(/\/dashboard/);
});

test('R11. the new account is a normal EMPLOYEE record visible to HR', async ({ page }) => {
  await login(page, creds.admin);
  await page.goto('/users');
  await page.getByTestId('search-input').fill(user.email);
  const row = page.getByRole('row', { name: new RegExp(user.email) });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText(/Employee/i);
});

for (const [name, size] of [['phone', { width: 375, height: 700 }], ['tablet', { width: 768, height: 900 }]] as const) {
  test(`R12 (${name}). responsive: no horizontal scroll, fields stacked on phones, submit reachable`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/register');
    await expect(page.getByTestId('reg-firstName')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByTestId('reg-submit').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('reg-submit')).toBeVisible();
    if (name === 'phone') {
      const a = await page.getByTestId('reg-firstName').boundingBox();
      const b = await page.getByTestId('reg-lastName').boundingBox();
      expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    }
  });
}

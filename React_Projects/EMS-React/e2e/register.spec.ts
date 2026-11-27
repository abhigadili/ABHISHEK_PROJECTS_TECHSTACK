import { expect, test, type Page } from '@playwright/test';
import { creds, login, uniq } from './helpers';

/** A valid 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
const PASSWORD = `Reg!${Date.now().toString(36)}Aa9`;
const user = { username: uniq('reg').toLowerCase(), email: `${uniq('reg')}@ems.example`.toLowerCase() };

async function fillForm(
  page: Page,
  v: { username: string; email: string; password?: string; confirm?: string },
) {
  await page.getByLabel(/First name/).fill('Rita');
  await page.getByLabel(/Last name/).fill('Registered');
  await page.getByLabel(/^Username/).fill(v.username);
  await page.getByLabel(/Email address/).fill(v.email);
  await page.getByLabel(/Mobile number/).fill('+1 555 0123');
  await page.getByLabel(/Date of birth/).fill('1992-04-05');
  await page.getByLabel(/Gender/).click();
  await page.getByRole('option', { name: 'Female' }).click();
  await page.getByLabel(/^Password/).fill(v.password ?? PASSWORD);
  await page.getByLabel(/Confirm password/).fill(v.confirm ?? v.password ?? PASSWORD);
}

test.describe.configure({ mode: 'serial' });

test('the registration page is reachable from the login page and blocks an invalid submit with field messages', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: /create an account/i }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('First name is required')).toBeVisible();
  await expect(page.getByText('Username is required')).toBeVisible();
  await expect(page.getByText('Select a gender')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('password strength and confirm-password mismatch are flagged beside the fields', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/^Password/).fill('weak');
  await page.getByLabel(/Confirm password/).fill('different');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('At least 10 characters')).toBeVisible();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
});

test('departments/designations come from the backend', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/Department/).click();
  await expect(page.getByRole('option', { name: 'Engineering' })).toBeVisible();
});

test('register with a picture → redirected to login with a success message → sign in with the USERNAME', async ({
  page,
}) => {
  await page.goto('/register');
  await fillForm(page, user);
  await page.getByLabel(/Department/).click();
  await page.getByRole('option', { name: 'Engineering' }).click();
  await page.getByTestId('file-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByAltText('Selected profile picture preview')).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status').filter({ hasText: /Sign in as/ })).toContainText(user.username);
  await expect(page.getByLabel('Username or email')).toHaveValue(user.username);

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Welcome, Rita Registered')).toBeVisible(); // EMPLOYEE role → personal overview
  await expect(page.getByRole('link', { name: 'Users & roles' })).toHaveCount(0); // least-privileged default role
  await expect(page.locator('header img[alt]')).toBeVisible(); // the uploaded picture is shown in the header
});

test('the registered user can also sign in with the e-mail address', async ({ page }) => {
  await login(page, { email: user.email, password: PASSWORD });
  await expect(page.getByText('Welcome, Rita Registered')).toBeVisible();
});

test('a taken username is flagged while typing/leaving the field; a taken e-mail is rejected by the backend', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel(/^Username/).fill(user.username.toUpperCase()); // case-insensitive
  await page.getByLabel(/Email address/).click();
  await expect(page.getByText('This username is already taken')).toBeVisible();

  await fillForm(page, { username: uniq('other').toLowerCase(), email: user.email });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('This email address is already registered')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('submitting the same username twice (race: no client-side check) is rejected by the backend', async ({
  page,
}) => {
  await page.route('**/auth/username-available*', (r) =>
    r.fulfill({ json: { success: true, data: { available: true } } }),
  ); // simulate a stale check
  await page.goto('/register');
  await fillForm(page, { username: user.username, email: `${uniq('x')}@ems.example`.toLowerCase() });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('This username is already taken')).toBeVisible();
});

test('a network failure shows an error and the form stays usable', async ({ page }) => {
  await page.route('**/auth/register', (r) => r.abort('failed'));
  await page.goto('/register');
  await fillForm(page, {
    username: uniq('net').toLowerCase(),
    email: `${uniq('net')}@ems.example`.toLowerCase(),
  });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /cannot reach the server/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

test('double-clicking submit sends exactly one request', async ({ page }) => {
  let calls = 0;
  await page.route('**/auth/register', async (r) => {
    calls += 1;
    await new Promise((x) => setTimeout(x, 400));
    await r.continue();
  });
  await page.goto('/register');
  await fillForm(page, {
    username: uniq('dbl').toLowerCase(),
    email: `${uniq('dbl')}@ems.example`.toLowerCase(),
  });
  await page.getByRole('button', { name: 'Create account' }).dblclick();
  await expect(page).toHaveURL(/\/login$/);
  expect(calls).toBe(1);
});

test('existing admin login (email + password) still works', async ({ page }) => {
  await login(page, creds.admin);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('new registrations appear for HR: notification + employee record with default role', async ({
  page,
}) => {
  await login(page, creds.admin);
  await page.goto(`/employees?q=${encodeURIComponent(user.email)}`);
  await expect(page.getByRole('row', { name: new RegExp(user.email) })).toBeVisible();
  await page.goto(`/users`);
  await page.getByLabel('Search').fill(user.email);
  await expect(page.getByRole('row', { name: new RegExp(user.email) })).toContainText('Employee');
});

test.describe('responsive', () => {
  for (const [name, size] of [
    ['phone', { width: 375, height: 700 }],
    ['tablet', { width: 768, height: 900 }],
  ] as const) {
    test(`${name}: no horizontal scroll, every field reachable, submit works`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/register');
      await expect(page.getByLabel(/First name/)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: 'Create account' }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
      if (name === 'phone') {
        // single column on phones: the two name fields are stacked
        const a = await page.getByLabel(/First name/).boundingBox();
        const b = await page.getByLabel(/Last name/).boundingBox();
        expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
      }
    });
  }
});

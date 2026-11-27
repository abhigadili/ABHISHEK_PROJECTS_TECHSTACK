import { expect, test } from '@playwright/test';
import { creds, login } from './helpers';

/**
 * Live proof of the Axios/RTK refresh logic. Requires a backend whose access tokens are SHORT-lived:
 *   JWT_ACCESS_TTL=4s NODE_ENV=test PORT=4101 node src/server.js      then   E2E_SHORT_TTL=1 npm run e2e
 * Skipped otherwise (with the default 15-minute TTL there is nothing to observe).
 */
test.skip(!process.env.E2E_SHORT_TTL, 'needs a backend started with JWT_ACCESS_TTL=4s');

test('expired access tokens are refreshed transparently; parallel requests share ONE refresh', async ({
  page,
}) => {
  const refreshCalls: number[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('/auth/refresh')) refreshCalls.push(r.status());
  });
  await login(page, creds.admin);
  await page.goto('/employees');
  await expect(page.getByRole('row', { name: /Alice Anders/ })).toBeVisible();

  await page.waitForTimeout(5500); // the access token is now expired

  // trigger several authenticated requests at once from a fresh render of the dashboard (KPIs, header badge, profile…)
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('kpi-Total employees')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
  expect(refreshCalls.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
  expect(refreshCalls.every((s) => s === 200)).toBe(true); // never a rejected (reused) refresh token

  // and again after a hard reload (no access token in memory at all → bootstrap + loader share the same refresh)
  await page.waitForTimeout(5500);
  await page.goto('/employees/4');
  await expect(page.getByRole('heading', { name: 'Alice Anders' })).toBeVisible();
  expect(refreshCalls.every((s) => s === 200)).toBe(true);
});

test('when the refresh token is revoked the user is signed out cleanly', async ({ page, browser }) => {
  await login(page, creds.employee);
  // another "device" signs out everywhere, which revokes every refresh token of this user
  const other = await (await browser.newContext()).newPage(); // a separate context = a separate device (own localStorage)
  await login(other, creds.employee);
  await other.goto('/settings');
  await other.getByRole('button', { name: 'Sign out of all devices' }).click();
  await other.getByRole('dialog').getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(other).toHaveURL(/\/login/);

  await page.waitForTimeout(5500); // access token expires → refresh is attempted → refused
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Leave' })
    .click();
  await expect(page).toHaveURL(/\/login/); // unrecoverable session → logout
});

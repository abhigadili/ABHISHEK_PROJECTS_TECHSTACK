import { expect, type Page } from '@playwright/test';

/** Credentials come from the environment (never committed). `npm run e2e:seed` creates these users on the TEST backend. */
export const creds = {
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? '', password: process.env.E2E_ADMIN_PASSWORD ?? '' },
  manager: { email: 'manny.manager@ems.example', password: process.env.E2E_USER_PASSWORD ?? '' },
  employee: { email: 'alice.anders@ems.example', password: process.env.E2E_USER_PASSWORD ?? '' },
};

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export const uniq = (prefix: string) => `${prefix}${Date.now().toString(36)}`;

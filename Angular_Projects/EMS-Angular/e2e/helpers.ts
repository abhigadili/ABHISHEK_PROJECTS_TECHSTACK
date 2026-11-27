import { Page, expect } from '@playwright/test';

/** Credentials come from the environment — never hard-coded. Seeded users share E2E_USER_PASSWORD (see e2e/seed.mjs). */
export const creds = {
  admin: { email: process.env['E2E_ADMIN_EMAIL'] ?? '', password: process.env['E2E_ADMIN_PASSWORD'] ?? '' },
  manager: { email: 'hannah.manager@ems.test', password: process.env['E2E_USER_PASSWORD'] ?? 'Seed-Pass#2026a' },
  employee: { email: 'eve.employee@ems.test', password: process.env['E2E_USER_PASSWORD'] ?? 'Seed-Pass#2026a' },
};

export async function login(page: Page, who: { email: string; password: string }, expectUrl: RegExp = /\/dashboard/): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(who.email);
  await page.getByTestId('login-password').fill(who.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(expectUrl);
}

export async function logout(page: Page): Promise<void> {
  await page.getByTestId('user-menu').click();
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);
}

/** Next weekday at least `daysAhead` days from today, as YYYY-MM-DD (local). */
export function futureWeekday(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function pickOption(page: Page, selectTestId: string, optionName: string | RegExp): Promise<void> {
  await page.getByTestId(selectTestId).click();
  await page.getByRole('option', { name: optionName }).first().click();
}

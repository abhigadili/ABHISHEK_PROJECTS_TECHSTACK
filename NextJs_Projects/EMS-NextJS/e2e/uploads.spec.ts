import { expect, test } from '@playwright/test';
import { USERS, login, noisePng } from './helpers';

test.describe.configure({ mode: 'serial' });

/** Server Action bodies are limited (default 1 MB) unless `experimental.serverActions.bodySizeLimit` is raised in next.config.ts — a ~1.5 MB upload exercises that setting. */
test('U1. a ~1.5 MB profile picture uploads through the Server Action (multipart) and shows on the profile', async ({ page }) => {
  await login(page, USERS.employee);
  await page.goto('/profile');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: noisePng() }); // ≈ 1.5 MB → needs the raised Server Action body limit
  await page.getByRole('button', { name: 'Upload picture' }).click();
  await expect(page.getByText('Profile picture updated')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: /Photo of Ella Brooks/ }).first()).toBeVisible();
});

test('U2. a file over the 2 MB picture limit is rejected in the browser before upload', async ({ page }) => {
  await login(page, USERS.employee);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle'); // the size check is a client-side onChange handler: wait until the page has hydrated
  await page.locator('input[type=file]').first().setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(2.5 * 1024 * 1024) });
  await expect(page.getByText(/too large/i)).toBeVisible();
});

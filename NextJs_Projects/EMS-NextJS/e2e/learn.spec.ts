import { expect, test } from '@playwright/test';

/** The isolated /learn demos (public, no EMS data): hooks, navigation functions, the four intercepting conventions. */
test('L1. hooks lab: reducer, deferred filter, layout measurement, optimistic update', async ({ page }) => {
  await page.goto('/learn/hooks');
  await page.getByLabel('New todo').fill('Write tests');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Write tests')).toBeVisible();
  await page.getByLabel('Filter items').fill('Item 19');
  await expect(page.getByText('Item 19', { exact: true })).toBeVisible();
  await expect(page.getByText('Item 190', { exact: true })).toBeVisible();
  expect(Number(await page.getByTestId('measured-width').textContent())).toBeGreaterThan(50);
  await page.getByTestId('like').click();
  await expect(page.getByTestId('like')).toContainText('1');
});

test('L2. navigation: redirect() 307, permanentRedirect() 308, notFound() 404, hook read-outs', async ({ page, request }) => {
  const a = await request.get('/learn/navigation/go', { maxRedirects: 0 });
  expect(a.status()).toBe(307);
  const b = await request.get('/learn/navigation/old-path', { maxRedirects: 0 });
  expect(b.status()).toBe(308);
  // notFound(): with Cache Components the response status of a dynamic not-found can be 200 (the shell streams first), so assert the RSC
  // not-found marker + the noindex robots meta instead (docs/nextjs-rendering-strategy.md explains this soft-404 caveat)
  const html = await (await request.get('/learn/navigation/does-not-exist')).text();
  expect(html).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(html).toContain('noindex');
  await page.goto('/learn/navigation/topic-redirect?x=1');
  await expect(page.getByTestId('nav-readout')).toContainText('topic-redirect');
  await expect(page.getByTestId('nav-readout')).toContainText('x=1');
  await page.getByRole('button', { name: 'router.push' }).click();
  await expect(page).toHaveURL(/push-demo\?x=1/);
});

for (const [label, start, link, url] of [
  ['(.)', '/learn/deep', 'l-dot', /\/learn\/deep\/photos\/1$/],
  ['(..)', '/learn/deep/nested', 'l-up1', /\/learn\/deep\/tools\/3$/],
  ['(..)(..)', '/learn/deep/a/b', 'l-up2', /\/learn\/deep\/gallery\/4$/],
  ['(...)', '/learn/deep', 'l-root', /\/learn\/root-demo\/9$/],
] as const) {
  test(`L3. intercepting ${label}: soft nav → modal, Back closes it, direct/refresh → full page`, async ({ page }) => {
    await page.goto(start);
    await page.getByTestId(link).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(url);
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByTestId(link).click();
    await expect(page).toHaveURL(url); // wait for the soft navigation to commit before reloading
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('full-page')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('L4. React patterns lab: HOC, render props, compound components, error boundary, memo/keys, state lifting', async ({ page }) => {
  await page.goto('/learn/react');
  await expect(page.getByText('HOC', { exact: true })).toBeVisible();
  await page.getByTestId('rp').click(); await expect(page.getByTestId('rp')).toHaveText('ON');
  await page.getByRole('tab', { name: 'Beta' }).click(); await expect(page.getByText('Beta panel')).toBeVisible();
  await page.getByRole('button', { name: 'Throw' }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Caught' })).toContainText('Boom (demo)'); // (Next also renders a route-announcer role=alert)
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await page.getByRole('button', { name: 'beta' }).click(); await expect(page.getByTestId('picked')).toHaveText('beta');
});

test('L5. React Hook Form lab: Controller, useWatch, nested fields and async validation', async ({ page }) => {
  await page.goto('/learn/forms');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('pro').check();
  await page.getByLabel('Seats').fill('3');
  await expect(page.getByTestId('price')).toHaveText('Price: $27/month'); // useWatch: only <Price> re-renders
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('At least one seat').or(page.getByText('City is required'))).toBeVisible(); // nested field error from the schema
  await page.getByLabel('City').fill('Oslo'); await page.getByLabel('ZIP').fill('12345');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('That username is taken (async check)')).toBeVisible();
  await page.getByLabel('Username').fill('newname');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByTestId('result')).toContainText('"city":"Oslo"');
});

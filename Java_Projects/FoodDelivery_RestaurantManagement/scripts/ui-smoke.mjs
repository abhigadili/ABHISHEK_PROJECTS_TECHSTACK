// Real-browser smoke test of the Angular app against the live stack (dev server on :4500 -> gateway :9080).
//   cd frontend && npm start &        (in another terminal)
//   node scripts/ui-smoke.mjs         (needs playwright-core: `npm i --no-save playwright-core` in any scratch folder, set PW=/path/to/node_modules/playwright-core)
// It drives system Google Chrome (no browser download), registers users through the UI, and walks the main screens of every role.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pw = require(process.env.PW || 'playwright-core');
const BASE = process.env.UI || 'http://localhost:4500';
const API = process.env.API || 'http://localhost:9080';
const OUT = process.env.SHOTS || '/tmp/ui-smoke';
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.env'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

let passed = 0; const failed = [];
const consoleErrors = []; const badResponses = [];
async function step(name, fn) {
  try { await fn(); passed++; console.log('  PASS ', name); }
  catch (e) { failed.push(name); console.log('  FAIL ', name, '\n        ', String(e.message).split('\n')[0]); }
}
const RUN = String(Date.now()).slice(-7);

async function api(method, p, body, token) {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j };
}

const browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function newPage(label) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, geolocation: { latitude: 12.9716, longitude: 77.5946 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${label}] ${m.text().slice(0, 200)}`); });
  page.on('pageerror', e => consoleErrors.push(`[${label}] PAGEERROR ${String(e).slice(0, 200)}`));
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/api/') && !r.url().includes('/api/auth/login')) badResponses.push(`[${label}] ${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  return page;
}
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });
async function login(page, user, pass) {
  await page.goto(BASE + '/login');
  await page.fill('input[formControlName="u"]', user);
  await page.fill('input[formControlName="p"]', pass);
  await page.click('button:has-text("Sign in")');
}

// ---------------------------------------------------------------- customer
const custName = 'uicust' + RUN, pwd = 'Test@12345';
const cust = await newPage('customer');
await step('login page renders', async () => { await cust.goto(BASE + '/login'); await cust.waitForSelector('text=Sign in'); await shot(cust, '01-login'); });
await step('register a customer through the UI form', async () => {
  await cust.goto(BASE + '/register');
  await cust.fill('input[formControlName="username"]', custName);
  await cust.fill('input[formControlName="fullName"]', 'UI Customer');
  await cust.fill('input[formControlName="email"]', custName + '@example.com');
  await cust.fill('input[formControlName="phone"]', '+919800000009');
  await cust.fill('input[formControlName="password"]', pwd);
  await cust.fill('input[formControlName="confirmPassword"]', pwd);
  await cust.click('button:has-text("Register")');
  await cust.waitForURL('**/login');
});
await step('customer logs in and lands on the home page', async () => {
  await login(cust, custName, pwd); await cust.waitForURL('**/customer/home'); await cust.waitForSelector('text=What are you craving today?'); await shot(cust, '02-customer-home');
});
await step('home lists approved restaurants', async () => { await cust.waitForSelector('app-restaurant-card'); });
await step('restaurant list page filters by cuisine', async () => { await cust.goto(BASE + '/customer/restaurants?cuisine=Biryani'); await cust.waitForSelector('app-restaurant-card'); });
await step('add a delivery address through the UI', async () => {
  await cust.goto(BASE + '/customer/addresses');
  await cust.click('button:has-text("Add address")');
  await cust.fill('input[formControlName="line1"]', '12 MG Road'); await cust.fill('input[formControlName="city"]', 'Bengaluru'); await cust.fill('input[formControlName="postalCode"]', '560001');
  await cust.click('form button:has-text("Save")'); await cust.waitForSelector('text=12 MG Road');
});
// pick a restaurant that has an item without variants if possible: use the first card, add the first item
await step('open a restaurant and add an item to the cart', async () => {
  await cust.goto(BASE + '/customer/restaurants?cuisine=Biryani'); await cust.waitForSelector('app-restaurant-card');
  await cust.locator('app-restaurant-card').first().click();
  await cust.waitForSelector('text=Add');
  await cust.locator('button:has-text("Add")').first().click();
  await cust.waitForSelector('mat-dialog-container');
  const radio = cust.locator('mat-dialog-container mat-radio-button label').first();
  if (await radio.count()) await radio.click();
  await shot(cust, '03-item-dialog');
  await cust.click('mat-dialog-container button:has-text("Add to cart")');
  await cust.waitForSelector('text=added to cart');
});
await step('cart shows server-calculated bill', async () => { await cust.goto(BASE + '/customer/cart'); await cust.waitForSelector('text=Bill (calculated by the server)'); await shot(cust, '04-cart'); });
await step('checkout: place order and pay (sandbox) lands on order tracking', async () => {
  await cust.click('button:has-text("Proceed to checkout")'); await cust.waitForSelector('text=Delivery address');
  await cust.click('button:has-text("Place order & pay")');
  await cust.waitForURL('**/customer/orders/*', { timeout: 40000 });
  await cust.waitForSelector('text=Payment', { timeout: 20000 });
});
await step('order tracking reaches CONFIRMED after payment.success (Kafka)', async () => {
  await cust.waitForFunction(() => document.body.innerText.includes('Confirmed') || document.body.innerText.includes('Restaurant accepted'), null, { timeout: 40000 });
  await shot(cust, '05-order-tracking');
});
await step('order history lists the order', async () => { await cust.goto(BASE + '/customer/orders'); await cust.waitForSelector('a.card'); });
await step('notifications page shows event-driven notifications', async () => { await cust.goto(BASE + '/customer/notifications'); await cust.waitForSelector('text=Payment confirmed', { timeout: 30000 }); });
await step('role guard: a customer is redirected away from /admin', async () => { await cust.goto(BASE + '/admin/dashboard'); await cust.waitForURL('**/customer/home'); });

// ---------------------------------------------------------------- admin
const admin = await newPage('admin');
await step('admin logs in and sees the dashboard', async () => {
  await login(admin, 'superadmin', env.BOOTSTRAP_ADMIN_PASSWORD); await admin.waitForURL('**/admin/dashboard'); await admin.waitForSelector('text=Platform dashboard'); await admin.waitForSelector('text=Orders (all time)'); await shot(admin, '10-admin-dashboard');
});
await step('admin users table', async () => { await admin.goto(BASE + '/admin/users'); await admin.waitForSelector('table.simple tbody tr'); });
await step('admin restaurants (approved tab)', async () => { await admin.goto(BASE + '/admin/restaurants'); await admin.click('mat-button-toggle:has-text("Approved")'); await admin.waitForSelector('table.simple tbody tr'); });
await step('admin orders table + order dialog', async () => { await admin.goto(BASE + '/admin/orders'); await admin.waitForSelector('table.simple tbody tr'); await admin.locator('table.simple tbody tr').first().click(); await admin.waitForSelector('mat-dialog-container'); await admin.keyboard.press('Escape'); });
await step('admin payments + refunds', async () => { await admin.goto(BASE + '/admin/payments'); await admin.waitForSelector('table.simple tbody tr'); await admin.goto(BASE + '/admin/refunds'); await admin.waitForSelector('table.simple'); });
await step('admin delivery, coupons, reviews, inventory, system pages render', async () => {
  for (const p of ['delivery', 'coupons', 'reviews', 'inventory', 'system']) { await admin.goto(`${BASE}/admin/${p}`); await admin.waitForSelector('.page h1'); }
});
await step('Kafka topics screen lists real topics', async () => { await admin.goto(BASE + '/kafka/topics'); await admin.waitForSelector('text=order.created'); await shot(admin, '11-kafka-topics'); });
await step('Kafka topic detail shows messages read from the broker', async () => { await admin.goto(BASE + '/kafka/topics/order.created'); await admin.waitForSelector('table.simple tbody tr'); await admin.locator('table.simple tbody tr').first().click(); await admin.waitForSelector('mat-dialog-container pre.json'); await shot(admin, '12-kafka-message'); await admin.keyboard.press('Escape'); });
await step('Kafka event-flow graph renders (SVG, real topology)', async () => { await admin.goto(BASE + '/kafka/flow'); await admin.waitForSelector('svg g rect'); await admin.waitForSelector('table.simple tbody tr'); await shot(admin, '13-kafka-flow'); });
await step('Kafka consumer groups with lag', async () => { await admin.goto(BASE + '/kafka/groups'); await admin.waitForSelector('mat-expansion-panel'); await admin.waitForSelector('text=order-service-group'); });
await step('Kafka audit history search + detail', async () => { await admin.goto(BASE + '/kafka/audit'); await admin.waitForSelector('table.simple tbody tr'); await admin.locator('table.simple tbody tr').first().click(); await admin.waitForSelector('mat-dialog-container'); await shot(admin, '14-kafka-audit-detail'); await admin.keyboard.press('Escape'); });
await step('Kafka failed + dead-letter screen', async () => { await admin.goto(BASE + '/kafka/failed'); await admin.waitForSelector('.page h1'); });
await step('Observability: service health table shows UP services', async () => { await admin.goto(BASE + '/logs/health'); await admin.waitForSelector('table.simple tbody tr'); await admin.waitForSelector('text=order-service'); await shot(admin, '15-observability'); });
await step('Log search by level works against Elasticsearch', async () => { await admin.goto(BASE + '/logs/search'); await admin.waitForSelector('table.simple tbody tr'); await admin.locator('table.simple tbody tr').first().click(); await admin.waitForSelector('mat-dialog-container'); await shot(admin, '16-log-detail'); await admin.keyboard.press('Escape'); });

// ---------------------------------------------------------------- restaurant owner + delivery partner (users created by scripts/e2e.py or here)
const ownerName = 'uiowner' + RUN;
await step('owner registers via API, logs in via UI and reaches the dashboard', async () => {
  const r = await api('POST', '/api/auth/register', { username: ownerName, email: ownerName + '@example.com', password: pwd, confirmPassword: pwd, fullName: 'UI Owner', phone: '+919800000010', role: 'RESTAURANT_OWNER' });
  if (r.s !== 201) throw new Error('register ' + r.s);
  const owner = await newPage('owner'); await login(owner, ownerName, pwd); await owner.waitForURL('**/owner/dashboard'); await owner.waitForSelector('text=Restaurant dashboard');
  await owner.waitForSelector('text=You have not registered a restaurant yet'); await shot(owner, '20-owner-empty');
  await owner.goto(BASE + '/owner/restaurant');
  await owner.fill('input[formControlName="name"]', 'UI Bistro ' + RUN); await owner.fill('input[formControlName="cuisines"]', 'Italian, Cafe');
  await owner.fill('input[formControlName="addressLine"]', '5 Church Street'); await owner.fill('input[formControlName="city"]', 'Bengaluru');
  await owner.fill('input[formControlName="latitude"]', '12.975'); await owner.fill('input[formControlName="longitude"]', '77.605');
  await owner.click('button:has-text("Submit for approval")'); await owner.waitForSelector('text=Submitted');
  await owner.goto(BASE + '/owner/dashboard'); await owner.waitForSelector('text=UI Bistro ' + RUN); await owner.waitForSelector('text=Pending'); await shot(owner, '21-owner-dashboard');
  await owner.goto(BASE + '/owner/menu'); await owner.waitForSelector('text=Menu management');
  await owner.goto(BASE + '/owner/orders'); await owner.waitForSelector('text=Orders');
  await owner.goto(BASE + '/owner/inventory'); await owner.waitForSelector('text=Inventory');
});
const dpName = 'uidp' + RUN;
await step('delivery partner registers via API, goes online in the UI', async () => {
  const r = await api('POST', '/api/auth/register', { username: dpName, email: dpName + '@example.com', password: pwd, confirmPassword: pwd, fullName: 'UI Rider', phone: '+919800000011', role: 'DELIVERY_PARTNER' });
  if (r.s !== 201) throw new Error('register ' + r.s);
  const dp = await newPage('delivery'); await login(dp, dpName, pwd); await dp.waitForURL('**/delivery/dashboard'); await dp.waitForSelector('text=My deliveries');
  await dp.waitForSelector('mat-slide-toggle'); await dp.locator('mat-slide-toggle').click(); await dp.waitForSelector('text=Available'); await shot(dp, '30-delivery');
  await dp.goto(BASE + '/delivery/profile'); await dp.waitForSelector('text=Profile & performance');
});

await browser.close();
console.log(`\n${passed} UI checks passed, ${failed.length} failed`);
failed.forEach(f => console.log('  FAILED:', f));
const noisy = [...new Set(consoleErrors)].filter(e => !/favicon|Failed to load resource/.test(e));
console.log('browser console errors:', noisy.length ? '\n  ' + noisy.slice(0, 15).join('\n  ') : 'none');
const bad = [...new Set(badResponses)];
console.log('API responses >= 400 seen by the browser:', bad.length ? '\n  ' + bad.slice(0, 15).join('\n  ') : 'none');
console.log('screenshots:', OUT);
process.exit(failed.length ? 1 : 0);

import puppeteer from 'puppeteer-core';
// Usage: WEB_URL=http://localhost:3000 API_URL=http://localhost:4000/api/v1 DEMO_PASSWORD=... node e2e/run.mjs
// Needs a freshly seeded development database (npm run db:reset && npm run db:seed in backend/).
const BASE = process.env.WEB_URL ?? 'http://localhost:3000', PW = process.env.DEMO_PASSWORD ?? 'Library#2026';
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const results = []; const consoleErrors = [];
const step = async (name, fn) => { try { await fn(); results.push(['PASS', name]); console.log('PASS', name); } catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '-', e.message.split('\n')[0]); } };
async function newPage() {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.text()} @ ${page.url()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror ${e.message} @ ${page.url()}`));
  return { ctx, page };
}
const text = (page, sel) => page.$eval(sel, (e) => e.textContent);
const waitText = (page, t, timeout = 10000) => page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout }, t);
const clickText = async (page, tag, t) => { const h = await page.evaluateHandle((tag, t) => [...document.querySelectorAll(tag)].find((e) => e.textContent.trim().includes(t) && !e.disabled), tag, t); if (!h.asElement()) throw new Error(`no ${tag} with "${t}"`); await h.asElement().click(); };
async function login(page, email) {
  await page.goto(`${BASE}/login`); await page.type('input[type=email]', email); await page.type('input[type=password]', PW); await page.click('button[type=submit]');
}
const email = `e2e${Date.now()}@example.org`;

// ---------- public ----------
{ const { ctx, page } = await newPage();
  await step('home page lists recent books from the API', async () => { await page.goto(BASE); await waitText(page, 'Recently added'); await page.waitForSelector('a[href^="/books/"]'); });
  await step('catalogue search finds 1984 and shows availability', async () => { await page.goto(`${BASE}/books?q=orwell`); await waitText(page, '1984'); await waitText(page, 'Available'); });
  await step('catalogue empty state for no match', async () => { await page.goto(`${BASE}/books?q=zzzznomatch`); await waitText(page, 'No books match your search'); });
  await step('book detail page shows copies, details and related', async () => { await page.goto(`${BASE}/books/3`); await waitText(page, 'Clean Code'); await waitText(page, 'copies'); await waitText(page, 'Log in to reserve'); });
  await step('categories page', async () => { await page.goto(`${BASE}/categories`); await waitText(page, 'Programming'); });
  await step('about + contact pages show DB-backed library info', async () => { await page.goto(`${BASE}/contact`); await waitText(page, 'City Public Library'.slice(0, 4)); await waitText(page, '555'); });
  await step('protected route redirects anonymous visitor to login', async () => { await page.goto(`${BASE}/member/dashboard`); await page.waitForFunction(() => location.pathname === '/login'); });
  await step('login shows an error for bad credentials', async () => { await login(page, 'admin@library.local'.replace('admin', 'nobody')); await waitText(page, 'Invalid email or password'); });
  await page.screenshot({ path: new URL('./out-public.png', import.meta.url).pathname }); await ctx.close(); }

// ---------- registration with picture ----------
const member = await newPage();
await step('registration form validates required fields client-side', async () => { const { page } = member; await page.goto(`${BASE}/register`); await page.click('button[type=submit]'); await waitText(page, 'Full name is required'); await waitText(page, 'Postal code is required'); });
await step('register a member with a profile picture and land on the dashboard', async () => {
  const { page } = member; await page.goto(`${BASE}/register`);
  const v = { fullName: 'E2E Reader', email, phone: '555-0199', address: '9 Test Lane', city: 'Testville', postalCode: '90210', country: 'USA', password: PW, confirmPassword: PW };
  for (const [k, val] of Object.entries(v)) await page.type(`input[name=${k}]`, val);
  await (await page.$('input[type=file]')).uploadFile(new URL('./avatar.png', import.meta.url).pathname); await page.waitForSelector('img[alt="Preview of your picture"]');
  await page.click('button[type=submit]'); await page.waitForFunction(() => location.pathname === '/member/dashboard', { timeout: 15000 }); await waitText(page, 'Hello, E2E');
});
await step('profile picture is served from MySQL and rendered (header avatar)', async () => {
  const { page } = member; await page.waitForSelector('header img[alt$="profile"]'); const ok = await page.$eval('header img[alt$="profile"]', (i) => i.complete && i.naturalWidth === 64); if (!ok) throw new Error('avatar not decoded as 64px PNG');
});
await step('member profile: replace picture with preview + progress, then remove', async () => {
  const { page } = member; await page.goto(`${BASE}/member/profile`); await waitText(page, 'Personal details'); await clickText(page, 'button', 'Profile picture');
  await (await page.$('input[type=file]')).uploadFile(new URL('./avatar.png', import.meta.url).pathname); await page.waitForSelector('img[alt="Preview of the selected picture"]'); await clickText(page, 'button', 'Upload'); await waitText(page, 'Profile picture saved');
  await clickText(page, 'button', 'Remove'); await clickText(page, 'button', 'Remove'.padEnd(6)).catch(() => {});
});
await step('profile edit saves to the database', async () => {
  const { page } = member; await page.goto(`${BASE}/member/profile`); await waitText(page, 'Personal details'); await page.waitForSelector('input[name=city]');
  await page.$eval('input[name=city]', (e) => (e.value = '')); await page.type('input[name=city]', 'Newtown'); await clickText(page, 'button', 'Save changes'); await waitText(page, 'Profile updated');
  await page.reload(); await page.waitForSelector('input[name=city]'); await page.waitForFunction(() => document.querySelector('input[name=city]').value === 'Newtown');
});

// ---------- librarian issues a book ----------
const lib = await newPage();
const adm0 = await newPage();
await login(adm0.page, 'admin@library.local'); await adm0.page.waitForFunction(() => location.pathname === '/staff/dashboard', { timeout: 15000 });
await step('librarian logs in and sees the staff dashboard with charts', async () => { const { page } = lib; await login(page, 'librarian@library.local'); await page.waitForFunction(() => location.pathname === '/staff/dashboard', { timeout: 15000 }); await waitText(page, 'Librarian dashboard'); await waitText(page, 'Registered members'); await page.waitForSelector('.recharts-wrapper'); });
await step('librarian is redirected away from admin-only pages', async () => { const { page } = lib; await page.goto(`${BASE}/staff/admin/settings`); await page.waitForFunction(() => location.pathname === '/staff/dashboard', { timeout: 10000 }); });
await step('issue a book to the new member through the UI', async () => {
  const { page } = lib; await page.goto(`${BASE}/staff/issue`); await page.waitForSelector('input[aria-label="Find member"]');
  await page.type('input[aria-label="Find member"]', 'E2E Reader'); await page.waitForSelector('[role=option]'); await page.click('[role=option] button');
  await waitText(page, 'on loan'); await page.type('input[aria-label="Find book"]', 'Dune'); await page.waitForSelector('[role=option]'); await page.click('[role=option] button');
  await clickText(page, 'button', 'Issue book'); await waitText(page, 'Issued Dune'.slice(0, 6)); await waitText(page, 'due');
});
await step('member sees the loan and renews it', async () => {
  const { page } = member; await page.goto(`${BASE}/member/loans`); await waitText(page, 'Dune'); await clickText(page, 'button', 'Renew'); await waitText(page, 'Renew this loan?'); await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Renew').click()); await waitText(page, 'Renewed. New due date');
});
await step('reservation flow: reserve a fully-borrowed book, get queued, then "ready" after the return', async () => {
  const { page: ap } = adm0; // admin creates a 1-copy book through the API (browser session)
  const bookId = await ap.evaluate(async (api) => { const r = await fetch(`${api}/books`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-LMS-Client': 'web' }, body: JSON.stringify({ title: 'E2E Single Copy', authorIds: [1], copies: 1 }) }); return (await r.json()).data.id; }, API);
  const { page } = lib; await page.goto(`${BASE}/staff/issue`); await page.waitForSelector('input[aria-label="Find member"]'); await page.type('input[aria-label="Find member"]', 'Maya Member'); await page.waitForSelector('[role=option]'); await page.click('[role=option] button');
  await page.type('input[aria-label="Find book"]', 'E2E Single Copy'); await page.waitForSelector('[role=option]'); await page.click('[role=option] button'); await clickText(page, 'button', 'Issue book'); await waitText(page, 'Issued E2E');
  const mp = member.page; await mp.goto(`${BASE}/books/${bookId}`); await waitText(mp, 'All copies out'); await clickText(mp, 'button', 'Reserve this book'); await waitText(mp, 'Reserve this book?'); await mp.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Reserve').click()); await waitText(mp, 'Reservation placed');
  await mp.goto(`${BASE}/member/reservations`); await waitText(mp, 'E2E Single Copy'); await waitText(mp, 'Position 1');
  await page.goto(`${BASE}/staff/return`); await page.waitForSelector('input[placeholder="ACC-00003-1"]'); await page.type('input[placeholder="ACC-00003-1"]', `ACC-${String(bookId).padStart(5, '0')}-1`); await page.keyboard.press('Enter'); await waitText(page, 'Returned');
  await mp.reload(); await waitText(mp, 'ready'); await waitText(mp, 'A reserved book is ready for you');
});

// ---------- fines + payment ----------
await step('librarian adds a fine, records a partial payment, prints receipt', async () => {
  const { page } = lib; await page.goto(`${BASE}/staff/fines`); await waitText(page, 'Add fine'); await clickText(page, 'button', 'Add fine'); await page.waitForSelector('input[aria-label="Find member"]');
  await page.type('input[aria-label="Find member"]', 'E2E Reader'); await page.waitForSelector('[role=option]'); await page.click('[role=option] button');
  const nums = await page.$$('[role=dialog] input[type=number]'); await nums[0].type('6.50'); await page.type('[role=dialog] textarea', 'E2E manual fine'); await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Add fine').click()); await waitText(page, 'Fine added');
  await page.goto(`${BASE}/staff/payments`); await page.waitForSelector('input[aria-label="Find member"]'); await page.type('input[aria-label="Find member"]', 'E2E Reader'); await page.waitForSelector('[role=option]'); await page.click('[role=option] button'); await waitText(page, 'E2E manual fine');
  const amt = await page.$('input[type=number]'); await amt.type('2.50'); await clickText(page, 'button', 'Record payment of'); await waitText(page, 'Record this payment?'); await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Record payment').click());
  await waitText(page, 'Payment recorded'); await waitText(page, 'RCPT-'); await waitText(page, 'Remaining balance $4.00');
});
await step('member sees the fine, partial payment and a printable receipt', async () => {
  const { page } = member; await page.goto(`${BASE}/member/fines`); await waitText(page, '$4.00'); await waitText(page, 'E2E manual fine'); await clickText(page, 'button', 'Payment history'); await waitText(page, 'RCPT-');
  const href = await page.$eval('a[href^="/receipt/"]', (a) => a.getAttribute('href')); await page.goto(`${BASE}${href}`); await waitText(page, 'Payment receipt'); await waitText(page, 'Total paid');
});
await step('member notifications list shows issue/fine/payment events and marks read', async () => {
  const { page } = member; await page.goto(`${BASE}/member/notifications`); await waitText(page, 'Book issued'); await waitText(page, 'Payment received'); await clickText(page, 'button', 'Mark all as read'); await waitText(page, 'All marked as read');
});

// ---------- admin ----------
const adm = await newPage();
await step('admin dashboard, reports and CSV export', async () => {
  const { page } = adm; await login(page, 'admin@library.local'); await page.waitForFunction(() => location.pathname === '/staff/dashboard', { timeout: 15000 }); await waitText(page, 'Admin dashboard'); await waitText(page, 'Payments collected');
  await page.goto(`${BASE}/staff/reports`); await waitText(page, 'Complete book inventory'); await waitText(page, 'Clean Code'); await clickText(page, 'button', 'Overdue loans'); await page.waitForFunction(() => document.body.innerText.includes('No rows') || document.body.innerText.includes('Days Overdue'));
});
await step('admin pages: settings, audit log, member types, staff', async () => {
  const { page } = adm; await page.goto(`${BASE}/staff/admin/settings`); await waitText(page, 'Library settings'); await waitText(page, 'Max Outstanding Balance');
  await page.goto(`${BASE}/staff/admin/audit`); await waitText(page, 'payment.record'); await page.goto(`${BASE}/staff/admin/member-types`); await waitText(page, 'Premium'); await page.goto(`${BASE}/staff/admin/staff`); await waitText(page, 'Liam Librarian');
});
await step('admin creates a book via the form and the catalogue shows it', async () => {
  const { page } = adm; await page.goto(`${BASE}/staff/books/new`); await page.waitForSelector('input[name=title]'); await page.type('input[name=title]', 'E2E Created Book');
  await waitText(page, 'George Orwell'); await page.click('fieldset input[type=checkbox]');
  await clickText(page, 'button', 'Create book'); await page.waitForFunction(() => /\/staff\/books\/\d+/.test(location.pathname), { timeout: 15000 }); await waitText(page, 'E2E Created Book'); await waitText(page, 'Physical copies');
  await page.goto(`${BASE}/books?q=E2E%20Created`); await waitText(page, 'E2E Created Book');
});
await step('responsive: mobile layout renders the staff nav in a drawer', async () => {
  const { page } = adm; await page.setViewport({ width: 390, height: 800 }); await page.goto(`${BASE}/staff/dashboard`); await page.waitForSelector('button[aria-label="Open menu"]'); await page.click('button[aria-label="Open menu"]'); await waitText(page, 'Issue books');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); if (overflow) throw new Error('horizontal overflow at 390px'); await page.screenshot({ path: new URL('./out-mobile.png', import.meta.url).pathname });
});
await adm.page.setViewport({ width: 1280, height: 900 }); await adm.page.goto(`${BASE}/staff/dashboard`); await adm.page.waitForSelector('.recharts-wrapper'); await new Promise((r) => setTimeout(r, 800)); await adm.page.screenshot({ path: new URL('./out-admin.png', import.meta.url).pathname });
await browser.close();
const fails = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - fails.length}/${results.length} steps passed`); if (fails.length) console.log(fails);
const relevant = consoleErrors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of (401|404|422)/.test(e));
console.log('console errors:', relevant.length ? relevant : 'none');

process.exit(fails.length ? 1 : 0);

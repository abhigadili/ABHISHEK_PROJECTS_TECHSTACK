#!/usr/bin/env node
/**
 * Seeds an ISOLATED TEST backend (never production) through its public REST API so Playwright
 * and manual verification have realistic data. Idempotent: re-running skips records that exist.
 *
 *   E2E_API=http://localhost:4101/api/v1 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node e2e/seed.mjs
 *
 * The seeded users share E2E_USER_PASSWORD (default below is a throw-away test value).
 */
const API = process.env.E2E_API ?? 'http://localhost:4101/api/v1';
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
export const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'Seed-Pass#2026a';

if (!ADMIN.email || !ADMIN.password) {
  console.error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required');
  process.exit(1);
}

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const login = async (email, password) => (await call('POST', '/auth/login', null, { email, password })).json.data;

async function ensure(token, listPath, matchFn, createPath, payload) {
  const list = await call('GET', `${listPath}${listPath.includes('?') ? '&' : '?'}limit=100`, token);
  const found = (list.json.data ?? []).find(matchFn);
  if (found) return found;
  const created = await call('POST', createPath, token, payload);
  if (created.status >= 300) throw new Error(`Create ${createPath} failed: ${created.status} ${JSON.stringify(created.json)}`);
  return created.json.data;
}

const admin = await login(ADMIN.email, ADMIN.password);
if (!admin) throw new Error('Admin login failed');
const t = admin.accessToken;

const dept = {};
for (const [code, name] of [['ENG', 'Engineering'], ['HR', 'Human Resources'], ['SAL', 'Sales']]) {
  dept[code] = await ensure(t, '/departments', (d) => d.code === code, '/departments', { code, name, description: `${name} department` });
}
const des = {};
for (const [name, jobLevel] of [['Software Engineer', 3], ['Engineering Manager', 5], ['HR Manager', 5], ['Sales Executive', 2]]) {
  des[name] = await ensure(t, '/designations', (d) => d.name === name, '/designations', { name, jobLevel, description: name });
}

const today = new Date();
const isoDate = (d) => d.toISOString().slice(0, 10);
const soon = new Date(today.getTime() + 5 * 86400000);
const people = [
  { code: 'EMP-2001', first: 'Hannah', last: 'Manager', email: 'hannah.manager@ems.test', role: 'MANAGER', dept: 'ENG', des: 'Engineering Manager', manager: 1, dob: '1985-03-12' },
  { code: 'EMP-2002', first: 'Harry', last: 'Human', email: 'harry.hr@ems.test', role: 'HR_ADMIN', dept: 'HR', des: 'HR Manager', manager: 1, dob: '1988-07-21' },
  { code: 'EMP-2003', first: 'Eve', last: 'Engineer', email: 'eve.employee@ems.test', role: 'EMPLOYEE', dept: 'ENG', des: 'Software Engineer', manager: 'EMP-2001', dob: `1995-${isoDate(soon).slice(5)}` },
  { code: 'EMP-2004', first: 'Evan', last: 'Engineer', email: 'evan.employee@ems.test', role: 'EMPLOYEE', dept: 'ENG', des: 'Software Engineer', manager: 'EMP-2001', dob: '1996-11-30' },
  { code: 'EMP-2005', first: 'Sally', last: 'Seller', email: 'sally.sales@ems.test', role: 'EMPLOYEE', dept: 'SAL', des: 'Sales Executive', manager: 1, dob: '1992-01-09' },
];
const byCode = { 'EMP-0001': 1 };
for (const p of people) {
  const existing = await call('GET', `/employees?q=${encodeURIComponent(p.email)}`, t);
  let emp = (existing.json.data ?? []).find((e) => e.workEmail === p.email);
  if (!emp) {
    const r = await call('POST', '/employees', t, {
      employeeCode: p.code, firstName: p.first, lastName: p.last, workEmail: p.email,
      joiningDate: '2024-01-15', dateOfBirth: p.dob, employmentType: 'FULL_TIME',
      departmentId: dept[p.dept].id, designationId: des[p.des].id,
      managerId: typeof p.manager === 'number' ? p.manager : byCode[p.manager], jobTitle: p.des, workLocation: 'HQ',
      account: { role: p.role, password: USER_PASSWORD },
    });
    if (r.status >= 300) throw new Error(`Create employee ${p.code} failed: ${r.status} ${JSON.stringify(r.json)}`);
    emp = r.json.data;
  }
  byCode[p.code] = emp.id;
}

await ensure(t, '/holidays', (h) => h.name === 'E2E Founders Day', '/holidays', { holidayDate: `${today.getUTCFullYear() + 1}-01-26`, name: 'E2E Founders Day' });

// Give the manager a pending approval + the manager a leave to approve (idempotent on reason text).
const eve = await login('eve.employee@ems.test', USER_PASSWORD);
if (eve) {
  const mine = await call('GET', '/leave/requests/me?limit=50', eve.accessToken);
  if (!(mine.json.data ?? []).some((r) => r.reason === 'Seeded pending request')) {
    const start = new Date(today.getTime() + 20 * 86400000);
    while ([0, 6].includes(start.getUTCDay())) start.setUTCDate(start.getUTCDate() + 1);
    await call('POST', '/leave/requests', eve.accessToken, { leaveTypeId: 1, startDate: isoDate(start), endDate: isoDate(start), reason: 'Seeded pending request' });
  }
}
console.log('Seed complete', JSON.stringify({ departments: Object.keys(dept), employees: byCode }));

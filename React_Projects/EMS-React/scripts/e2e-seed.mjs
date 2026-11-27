#!/usr/bin/env node
/* Seeds an ISOLATED test backend (never the dev DB) with a small org so the Playwright suite and manual
 * exploration have realistic data. Credentials come from the environment, never from source:
 *   E2E_API=http://localhost:4101/api/v1 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_USER_PASSWORD=... npm run e2e:seed
 * Idempotent: re-running skips records that already exist. */
const API = process.env.E2E_API || 'http://localhost:4101/api/v1';
const { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_PASSWORD } = process.env;
if (!E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD || !E2E_USER_PASSWORD) {
  console.error('Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD and E2E_USER_PASSWORD'); process.exit(1);
}
let token = '';
async function call(method, path, body) {
  const res = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
const must = (r, what) => { if (r.status >= 400 && r.status !== 409) throw new Error(`${what} failed ${r.status} ${JSON.stringify(r.json)}`); return r.json.data; };

const login = await call('POST', '/auth/login', { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD });
token = must(login, 'login').accessToken;

const dept = async (code, name) => {
  const list = (await call('GET', `/departments?q=${code}`)).json.data ?? [];
  return list.find((d) => d.code === code) ?? must(await call('POST', '/departments', { code, name, description: `${name} department` }), `dept ${code}`);
};
const desig = async (name, jobLevel) => {
  const list = (await call('GET', `/designations?q=${encodeURIComponent(name)}`)).json.data ?? [];
  return list.find((d) => d.name === name) ?? must(await call('POST', '/designations', { name, jobLevel, description: name }), `designation ${name}`);
};
const eng = await dept('ENG', 'Engineering'); const hr = await dept('HR', 'Human Resources'); const sales = await dept('SAL', 'Sales');
const dir = await desig('Director', 8); const mgr = await desig('Engineering Manager', 6); const dev = await desig('Software Engineer', 3); const hrm = await desig('HR Manager', 6);

const emp = async (code, first, last, email, role, d, des, managerId, extra = {}) => {
  const found = (await call('GET', `/employees?q=${encodeURIComponent(email)}&status=ALL`)).json.data?.find((e) => e.workEmail === email);
  if (found) return found;
  return must(await call('POST', '/employees', {
    employeeCode: code, firstName: first, lastName: last, workEmail: email, joiningDate: '2024-03-01', employmentType: 'FULL_TIME',
    departmentId: d.id, designationId: des.id, managerId, jobTitle: des.name, dateOfBirth: '1990-11-12', phone: '+1 555 0100', salary: 90000, salaryCurrency: 'USD',
    account: { role, password: E2E_USER_PASSWORD }, ...extra,
  }), `employee ${email}`);
};
const root = (await call('GET', '/employees?q=EMP-0001&status=ALL')).json.data[0];
const director = await emp('EMP-2001', 'Dana', 'Director', 'dana.director@ems.example', 'HR_ADMIN', hr, dir, root.id);
const manager = await emp('EMP-2002', 'Manny', 'Manager', 'manny.manager@ems.example', 'MANAGER', eng, mgr, director.id);
const alice = await emp('EMP-2003', 'Alice', 'Anders', 'alice.anders@ems.example', 'EMPLOYEE', eng, dev, manager.id);
const bob = await emp('EMP-2004', 'Bob', 'Brown', 'bob.brown@ems.example', 'EMPLOYEE', eng, dev, manager.id);
await emp('EMP-2005', 'Cara', 'Chen', 'cara.chen@ems.example', 'EMPLOYEE', sales, dev, director.id);
await emp('EMP-2006', 'Dev', 'Dutta', 'dev.dutta@ems.example', 'EMPLOYEE', hr, hrm, director.id);

await call('POST', '/holidays', { holidayDate: `${new Date().getFullYear()}-12-25`, name: 'Christmas Day' });
console.log(JSON.stringify({ ok: true, ids: { eng: eng.id, hr: hr.id, director: director.id, manager: manager.id, alice: alice.id, bob: bob.id } }));

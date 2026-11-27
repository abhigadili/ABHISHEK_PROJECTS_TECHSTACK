// Seeds a small organisation THROUGH THE EXPRESS API into the isolated TEST backend (never the dev one).
// Usage: EMS_API_URL=http://localhost:4101/api/v1 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_USER_PASSWORD=… node scripts/e2e-seed.mjs
const API = process.env.EMS_API_URL ?? 'http://localhost:4101/api/v1';
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}`); process.exit(1); } return v; };
if (/:4100\b/.test(API)) { console.error('Refusing to seed the development backend (:4100). Point EMS_API_URL at the test backend.'); process.exit(1); }
const adminEmail = need('E2E_ADMIN_EMAIL'), adminPassword = need('E2E_ADMIN_PASSWORD'), userPassword = need('E2E_USER_PASSWORD');

async function call(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${j?.error?.message ?? ''} ${JSON.stringify(j?.error?.details ?? '')}`);
  return j.data ?? j;
}
const { accessToken: token } = await call('/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
const existing = await call('/employees?limit=100', { token });
if (existing.some((e) => e.workEmail === 'hr.seed@ems.example')) { console.log('Already seeded.'); process.exit(0); }

const dept = (code, name) => call('/departments', { method: 'POST', token, body: { code, name } });
const desig = (name, jobLevel) => call('/designations', { method: 'POST', token, body: { name, jobLevel } });
const eng = await dept('ENG', 'Engineering'), ppl = await dept('PPL', 'People Operations');
const dm = await desig('Engineering Manager', 6), dh = await desig('HR Partner', 4), de = await desig('Software Engineer', 3);
const emp = (firstName, lastName, workEmail, extra) => call('/employees', { method: 'POST', token, body: { firstName, lastName, workEmail, joiningDate: '2024-03-01', employmentType: 'FULL_TIME', workLocation: 'Office', ...extra } });
const hr = await emp('Hana', 'Rivera', 'hr.seed@ems.example', { departmentId: ppl.id, designationId: dh.id, jobTitle: 'HR Partner', account: { role: 'HR_ADMIN', password: userPassword } });
const mgr = await emp('Mark', 'Stone', 'manager.seed@ems.example', { departmentId: eng.id, designationId: dm.id, jobTitle: 'Engineering Manager', account: { role: 'MANAGER', password: userPassword } });
const w1 = await emp('Ella', 'Brooks', 'employee.seed@ems.example', { departmentId: eng.id, designationId: de.id, managerId: mgr.id, jobTitle: 'Software Engineer', account: { role: 'EMPLOYEE', password: userPassword } });
await emp('Omar', 'Diaz', 'omar.seed@ems.example', { departmentId: eng.id, designationId: de.id, managerId: mgr.id, jobTitle: 'Software Engineer' });
console.log(JSON.stringify({ ok: true, hr: hr.id, manager: mgr.id, employee: w1.id }));

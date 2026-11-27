const { api, P, db, resetDb, actor, login } = require('../helpers');

let hr;
beforeAll(async () => { await resetDb(); hr = await actor('HR_ADMIN'); }); // exists BEFORE registrations, so it receives their notifications
afterAll(() => db.close());

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const valid = (o = {}) => ({ firstName: 'Rita', lastName: 'Reg', username: 'rita.reg', email: 'rita.reg@test.example', mobile: '+1 555 0123', password: 'Str0ng-Passw0rd!',
  dateOfBirth: '1992-04-05', gender: 'FEMALE', address: '1 Main St', ...o });
const post = (fields, file) => {
  const r = api().post(`${P}/auth/register`);
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) r.field(k, String(v));
  if (file) r.attach('file', file, { filename: 'me.png', contentType: 'image/png' });
  return r;
};

describe('POST /auth/register', () => {
  test('creates an EMPLOYEE account, never returns hashes, stores a bcrypt hash and the employee record', async () => {
    const res = await post(valid(), PNG);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ username: 'rita.reg', email: 'rita.reg@test.example', role: 'EMPLOYEE' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    const [u] = await db.query('SELECT username, password_hash, role_id, employee_id, is_active FROM users WHERE username = ?', ['rita.reg']);
    expect(u.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);          // bcrypt
    expect(u.password_hash).not.toContain('Str0ng');
    expect(u).toMatchObject({ role_id: 4, is_active: 1 });
    const [e] = await db.query('SELECT first_name, phone, gender, date_of_birth, address_line, status, department_id FROM employees WHERE id = ?', [u.employee_id]);
    expect(e).toMatchObject({ first_name: 'Rita', phone: '+1 555 0123', gender: 'FEMALE', date_of_birth: '1992-04-05', address_line: '1 Main St', status: 'ACTIVE' });
    const [pic] = await db.query('SELECT size_bytes FROM employee_profile_pictures WHERE employee_id = ?', [u.employee_id]);
    expect(pic.size_bytes).toBe(PNG.length);
  });

  test('the new user can log in with the USERNAME (case-insensitive) and with the EMAIL; a wrong password is refused', async () => {
    const byName = await api().post(`${P}/auth/login`).send({ username: 'Rita.Reg', password: 'Str0ng-Passw0rd!' });
    expect(byName.status).toBe(200);
    expect(byName.body.data.user).toMatchObject({ username: 'rita.reg', role: 'EMPLOYEE' });
    const byEmail = await api().post(`${P}/auth/login`).send({ email: 'rita.reg@test.example', password: 'Str0ng-Passw0rd!' });
    expect(byEmail.status).toBe(200);
    const bad = await api().post(`${P}/auth/login`).send({ username: 'rita.reg', password: 'Wrong-Passw0rd!' });
    expect(bad.status).toBe(401);
    const none = await api().post(`${P}/auth/login`).send({ password: 'x' });
    expect(none.status).toBe(400);
    const me = await api().get(`${P}/auth/me`).set('Authorization', `Bearer ${byName.body.data.accessToken}`);
    expect(me.body.data).toMatchObject({ username: 'rita.reg', role: 'EMPLOYEE' });
  });

  test('a self-registered user has only EMPLOYEE permissions (cannot create employees or read admin reports)', async () => {
    const tok = (await api().post(`${P}/auth/login`).send({ username: 'rita.reg', password: 'Str0ng-Passw0rd!' })).body.data.accessToken;
    const h = { Authorization: `Bearer ${tok}` };
    expect((await api().get(`${P}/reports/departments`).set(h)).status).toBe(403);
    expect((await api().post(`${P}/employees`).set(h).send({ firstName: 'a', lastName: 'b', workEmail: 'a@b.co', joiningDate: '2026-01-01' })).status).toBe(403);
  });

  test('duplicate username → 409 DUPLICATE_USERNAME; duplicate email → 409 DUPLICATE_EMAIL; both are reported per field', async () => {
    const u = await post(valid({ email: 'other@test.example' }));
    expect(u.status).toBe(409); expect(u.body.error.code).toBe('DUPLICATE_USERNAME');
    const e = await post(valid({ username: 'someone.else' }));
    expect(e.status).toBe(409); expect(e.body.error.code).toBe('DUPLICATE_EMAIL');
    const both = await post(valid());
    expect(both.body.error.details.map((d) => d.field).sort()).toEqual(['email', 'username']);
    expect((await post(valid({ username: 'RITA.REG', email: 'x@test.example' }))).status).toBe(409); // case-insensitive
    expect((await post(valid({ username: 'new.name', email: 'RITA.REG@test.example' }))).status).toBe(409);
  });

  test('an e-mail already used by an existing employee (admin-created) is also rejected', async () => {
    const res = await post(valid({ username: 'brand.new', email: hr.email }));
    expect(res.status).toBe(409); expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test.each([
    ['firstName', { firstName: '' }], ['lastName', { lastName: undefined }], ['username too short', { username: 'ab' }], ['username with @', { username: 'a@b.c' }],
    ['username with space', { username: 'bad name' }], ['email', { email: 'nope' }], ['mobile', { mobile: 'abc' }], ['weak password', { password: 'password' }],
    ['no password', { password: undefined }], ['future DOB', { dateOfBirth: '2999-01-01' }], ['bad DOB format', { dateOfBirth: '05/04/1992' }],
    ['gender', { gender: 'ROBOT' }], ['long address', { address: 'x'.repeat(300) }], ['bad department id', { departmentId: 'abc' }],
  ])('rejects invalid %s with a structured 400 and creates nothing', async (_n, o) => {
    const before = (await db.query('SELECT COUNT(*) c FROM users'))[0].c;
    const res = await post(valid({ username: 'valid.user', email: 'valid.user@test.example', ...o }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect((await db.query('SELECT COUNT(*) c FROM users'))[0].c).toBe(before);
  });

  test('mass assignment is impossible: role/status/employeeCode/salary in the body are ignored', async () => {
    const res = await post(valid({ username: 'sneaky', email: 'sneaky@test.example', role: 'SUPER_ADMIN', roleId: 1, status: 'TERMINATED', salary: 999999, employeeCode: 'EMP-9' }));
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('EMPLOYEE');
    const [row] = await db.query('SELECT u.role_id, e.salary, e.status, e.employee_code FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.username = ?', ['sneaky']);
    expect(row.role_id).toBe(4); expect(row.salary).toBeNull(); expect(row.status).toBe('ACTIVE'); expect(row.employee_code).not.toBe('EMP-9');
  });

  test('confirmPassword is ignored if a client sends it', async () => {
    expect((await post(valid({ username: 'with.confirm', email: 'with.confirm@test.example', confirmPassword: 'whatever' }))).status).toBe(201);
  });

  test('picture must be a real image (type + magic bytes)', async () => {
    const r = api().post(`${P}/auth/register`);
    for (const [k, v] of Object.entries(valid({ username: 'pic.fake', email: 'pic.fake@test.example' }))) r.field(k, v);
    r.attach('file', Buffer.from('not an image at all'), { filename: 'x.png', contentType: 'image/png' });
    const res = await r;
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    expect((await db.query("SELECT COUNT(*) c FROM users WHERE username = 'pic.fake'"))[0].c).toBe(0);
  });

  test('department and designation are validated (inactive/unknown → 422) and stored when valid', async () => {
    const dept = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'REGD', name: 'Reg Dept' })).body.data;
    const des = (await api().post(`${P}/designations`).set(hr.auth).send({ name: 'Reg Designer', jobLevel: 2 })).body.data;
    const bad = await post(valid({ username: 'dept.bad', email: 'dept.bad@test.example', departmentId: 99999 }));
    expect(bad.status).toBe(422); expect(bad.body.error.code).toBe('INVALID_DEPARTMENT');
    const ok = await post(valid({ username: 'dept.ok', email: 'dept.ok@test.example', departmentId: dept.id, designationId: des.id }));
    expect(ok.status).toBe(201);
    const [e] = await db.query('SELECT department_id, designation_id, job_title FROM employees WHERE id = ?', [ok.body.data.employeeId]);
    expect(e).toMatchObject({ department_id: dept.id, designation_id: des.id, job_title: 'Reg Designer' });
  });

  test('HR admins are notified of the registration', async () => {
    const notes = (await api().get(`${P}/notifications`).set(hr.auth)).body.data;
    expect(notes.some((n) => n.title === 'New self-registration')).toBe(true);
  });
});

describe('public helper endpoints', () => {
  test('username-available reflects reality, case-insensitively, and validates input', async () => {
    expect((await api().get(`${P}/auth/username-available?username=rita.reg`)).body.data.available).toBe(false);
    expect((await api().get(`${P}/auth/username-available?username=RITA.REG`)).body.data.available).toBe(false);
    expect((await api().get(`${P}/auth/username-available?username=free.name`)).body.data.available).toBe(true);
    expect((await api().get(`${P}/auth/username-available?username=a`)).status).toBe(400);
  });
  test('registration-options exposes only id+name of ACTIVE departments/designations', async () => {
    const res = await api().get(`${P}/auth/registration-options`);
    expect(res.status).toBe(200);
    expect(res.body.data.departments.some((d) => d.name === 'Reg Dept')).toBe(true);
    expect(Object.keys(res.body.data.departments[0]).sort()).toEqual(['id', 'name']);
  });
  test('existing login behaviour is unchanged for admin-created accounts (email + password)', async () => {
    const l = await login(hr.email);
    expect(l).toBeTruthy();
  });
});

const { api, P, db, resetDb, actor, makeEmployee, PNG, JPEG, PASSWORD } = require('../helpers');

let hr; let mgr; let emp; let dept; let desig;
beforeAll(async () => {
  await resetDb();
  hr = await actor('HR_ADMIN');
  mgr = await actor('MANAGER');
  emp = await actor('EMPLOYEE');
  dept = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'ENG', name: 'Engineering' })).body.data;
  desig = (await api().post(`${P}/designations`).set(hr.auth).send({ name: 'Engineer', jobLevel: 3 })).body.data;
});
afterAll(() => db.close());

const newEmployee = (over = {}) => ({ firstName: 'Jane', lastName: 'Doe', workEmail: `jane.${Math.random().toString(36).slice(2, 8)}@test.example`, joiningDate: '2025-03-03', ...over });

describe('employee CRUD', () => {
  test('HR creates an employee with auto code, history, and optional login', async () => {
    const body = newEmployee({ departmentId: dept.id, designationId: desig.id, jobTitle: 'Backend Engineer', salary: 90000, salaryCurrency: 'USD', account: { role: 'EMPLOYEE', password: PASSWORD } });
    const res = await api().post(`${P}/employees`).set(hr.auth).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ firstName: 'Jane', status: 'ACTIVE', department: { id: dept.id }, compensation: { salary: 90000 }, account: { role: 'EMPLOYEE' } });
    expect(res.body.data.employeeCode).toMatch(/^EMP-\d+$/);
    const login = await api().post(`${P}/auth/login`).send({ email: body.workEmail, password: PASSWORD });
    expect(login.status).toBe(200);
    const hist = await api().get(`${P}/employees/${res.body.data.id}/job-history`).set(hr.auth);
    expect(hist.body.data[0].changeType).toBe('JOINED');
  });
  test('validation failures list each bad field', async () => {
    const res = await api().post(`${P}/employees`).set(hr.auth).send({ firstName: '', workEmail: 'bad', joiningDate: '2025-13-40', salary: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['firstName', 'lastName', 'workEmail', 'joiningDate', 'salary']));
  });
  test('duplicate work email and duplicate employee code -> 409', async () => {
    const a = newEmployee({ employeeCode: 'DUP-001' });
    expect((await api().post(`${P}/employees`).set(hr.auth).send(a)).status).toBe(201);
    const sameEmail = await api().post(`${P}/employees`).set(hr.auth).send({ ...newEmployee(), workEmail: a.workEmail.toUpperCase() });
    expect(sameEmail.status).toBe(409); expect(sameEmail.body.error.code).toBe('DUPLICATE_EMAIL');
    const sameCode = await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ employeeCode: 'DUP-001' }));
    expect(sameCode.status).toBe(409);
  });
  test('invalid references are rejected', async () => {
    expect((await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ departmentId: 99999 }))).status).toBe(422);
    expect((await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ managerId: 99999 }))).status).toBe(422);
  });
  test('update changes fields, writes job history and ignores unknown/protected fields', async () => {
    const c = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ departmentId: dept.id }))).body.data;
    const res = await api().put(`${P}/employees/${c.id}`).set(hr.auth).send({ jobTitle: 'Staff Engineer', designationId: desig.id, changeType: 'PROMOTION', id: 9999, employeeCode: 'HACK', status: 'TERMINATED' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: c.id, employeeCode: c.employeeCode, status: 'ACTIVE', jobTitle: 'Staff Engineer' });
    const hist = (await api().get(`${P}/employees/${c.id}/job-history`).set(hr.auth)).body.data;
    expect(hist[0]).toMatchObject({ changeType: 'PROMOTION', toJobTitle: 'Staff Engineer' });
  });
  test('get 404 for unknown id', async () => {
    expect((await api().get(`${P}/employees/987654`).set(hr.auth)).status).toBe(404);
  });
});

describe('confidential data', () => {
  let target;
  beforeAll(async () => { target = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ salary: 123456, salaryCurrency: 'USD', dateOfBirth: '1991-02-03', personalEmail: 'priv@test.example' }))).body.data; });

  test('HR sees salary; manager and other employees do not', async () => {
    const asHr = (await api().get(`${P}/employees/${target.id}`).set(hr.auth)).body.data;
    expect(asHr.compensation.salary).toBe(123456);
    for (const viewer of [mgr, emp]) {
      const d = (await api().get(`${P}/employees/${target.id}`).set(viewer.auth)).body.data;
      expect(d.compensation).toBeUndefined();
      expect(d.dateOfBirth).toBeUndefined();
      expect(d.personalEmail).toBeUndefined();
      expect(JSON.stringify(d)).not.toContain('123456');
    }
  });
  test('list never leaks salary to non-admins', async () => {
    const res = await api().get(`${P}/employees?limit=100`).set(emp.auth);
    expect(res.status).toBe(200);
    const others = res.body.data.filter((e) => e.id !== emp.employeeId); // own row legitimately includes own data
    expect(others.length).toBeGreaterThan(3);
    expect(JSON.stringify(others)).not.toMatch(/salary|compensation|dateOfBirth|personalEmail/);
  });
  test('an employee sees own salary via profile, can edit only permitted fields', async () => {
    const own = await api().get(`${P}/profile`).set(emp.auth);
    expect(own.body.data.compensation.salary).toBe(50000);
    const upd = await api().patch(`${P}/profile`).set(emp.auth).send({ phone: '+1 555 0100', city: 'Austin' });
    expect(upd.status).toBe(200); expect(upd.body.data.phone).toBe('+1 555 0100');
    for (const bad of [{ salary: 1 }, { managerId: 1 }, { role: 'SUPER_ADMIN' }, { workEmail: 'x@y.z' }, { status: 'ACTIVE' }]) {
      expect((await api().patch(`${P}/profile`).set(emp.auth).send(bad)).status).toBe(400);
    }
    expect((await api().get(`${P}/profile`).set(emp.auth)).body.data.compensation.salary).toBe(50000);
  });
  test('employee cannot update others; job history is restricted', async () => {
    expect((await api().put(`${P}/employees/${target.id}`).set(emp.auth).send({ jobTitle: 'x' })).status).toBe(403);
    expect((await api().get(`${P}/employees/${target.id}/job-history`).set(emp.auth)).status).toBe(403);
    expect((await api().get(`${P}/employees/${emp.employeeId}/job-history`).set(emp.auth)).status).toBe(200);
  });
  test('manager can read job history of a report only', async () => {
    const report = await makeEmployee({ managerId: mgr.employeeId });
    const other = await makeEmployee({});
    expect((await api().get(`${P}/employees/${report.employeeId}/job-history`).set(mgr.auth)).status).toBe(200);
    expect((await api().get(`${P}/employees/${other.employeeId}/job-history`).set(mgr.auth)).status).toBe(403);
  });
});

describe('search, filter, sort, paginate', () => {
  beforeAll(async () => {
    const d2 = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'OPS', name: 'Operations' })).body.data;
    for (const [i, n] of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].entries()) {
      await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ firstName: n, lastName: 'Searchable', departmentId: i < 3 ? d2.id : dept.id, employmentType: i % 2 ? 'CONTRACT' : 'FULL_TIME', joiningDate: `2025-0${i + 1}-10` }));
    }
    global.opsId = d2.id;
  });
  test('text search matches name/email/code and escapes wildcards', async () => {
    const res = await api().get(`${P}/employees?q=Searchable&limit=100`).set(hr.auth);
    expect(res.body.meta.total).toBe(5);
    expect((await api().get(`${P}/employees?q=%25`).set(hr.auth)).body.meta.total).toBe(0); // literal %, not a wildcard
  });
  test('filters by department and employment type', async () => {
    expect((await api().get(`${P}/employees?q=Searchable&departmentId=${global.opsId}`).set(hr.auth)).body.meta.total).toBe(3);
    const c = await api().get(`${P}/employees?q=Searchable&employmentType=CONTRACT`).set(hr.auth);
    expect(c.body.meta.total).toBe(2); expect(c.body.data.every((e) => e.employmentType === 'CONTRACT')).toBe(true);
  });
  test('pagination + sorting', async () => {
    const p1 = await api().get(`${P}/employees?q=Searchable&limit=2&page=1&sort=joiningDate:desc`).set(hr.auth);
    const p3 = await api().get(`${P}/employees?q=Searchable&limit=2&page=3&sort=joiningDate:desc`).set(hr.auth);
    expect(p1.body.meta).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(p1.body.data.map((e) => e.joiningDate)).toEqual(['2025-05-10', '2025-04-10']);
    expect(p3.body.data).toHaveLength(1);
    expect((await api().get(`${P}/employees?limit=1000`).set(hr.auth)).status).toBe(400);
  });
  test('SQL-injection style sort/search input is inert', async () => {
    expect((await api().get(`${P}/employees?sort=${encodeURIComponent('name; DROP TABLE employees')}`).set(hr.auth)).status).toBe(200);
    expect((await api().get(`${P}/employees?q=${encodeURIComponent("' OR '1'='1")}`).set(hr.auth)).body.meta.total).toBe(0);
    expect((await api().get(`${P}/employees?limit=1`).set(hr.auth)).body.meta.total).toBeGreaterThan(0);
  });
  test('non-admins cannot list inactive staff', async () => {
    expect((await api().get(`${P}/employees?status=ALL&q=Searchable`).set(emp.auth)).body.meta.total).toBe(5);
  });
});

describe('deactivation', () => {
  test('soft-deactivates, disables login, keeps history; blocks while reports exist', async () => {
    const boss = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ account: { role: 'MANAGER', password: PASSWORD } }))).body.data;
    const sub = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ managerId: boss.id }))).body.data;
    const blocked = await api().delete(`${P}/employees/${boss.id}`).set(hr.auth).send({});
    expect(blocked.status).toBe(409); expect(blocked.body.error.code).toBe('HAS_ACTIVE_REPORTS');
    const ok = await api().delete(`${P}/employees/${boss.id}`).set(hr.auth).send({ reason: 'Resigned', reassignReportsTo: mgr.employeeId });
    expect(ok.status).toBe(200);
    const after = (await api().get(`${P}/employees/${boss.id}`).set(hr.auth)).body.data;
    expect(after.status).toBe('INACTIVE');
    expect((await api().get(`${P}/employees/${sub.id}`).set(hr.auth)).body.data.manager.id).toBe(mgr.employeeId);
    const [[u]] = await db.getPool().query('SELECT is_active FROM users WHERE employee_id = ?', [boss.id]);
    expect(u.is_active).toBe(0);
    expect((await api().delete(`${P}/employees/${boss.id}`).set(hr.auth).send({})).status).toBe(409);
    expect((await api().post(`${P}/employees/${boss.id}/reactivate`).set(hr.auth)).status).toBe(200);
  });
  test('cannot deactivate self', async () => {
    expect((await api().delete(`${P}/employees/${hr.employeeId}`).set(hr.auth).send({})).status).toBe(422);
  });
});

describe('profile pictures', () => {
  test('valid PNG/JPEG upload, download, replace and removal', async () => {
    const up = await api().put(`${P}/profile/picture`).set(emp.auth).attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(up.status).toBe(200); expect(up.body.data.mimeType).toBe('image/png');
    const dl = await api().get(`${P}/profile/picture`).set(emp.auth);
    expect(dl.status).toBe(200); expect(dl.headers['content-type']).toBe('image/png'); expect(Buffer.compare(dl.body, PNG)).toBe(0);
    expect((await api().put(`${P}/profile/picture`).set(emp.auth).attach('file', JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' })).status).toBe(200);
    expect((await api().get(`${P}/employees/${emp.employeeId}`).set(hr.auth)).body.data.profilePictureUrl).toBe(`/api/v1/employees/${emp.employeeId}/picture`);
    expect((await api().get(`${P}/employees/${emp.employeeId}/picture`).set(mgr.auth)).status).toBe(200);
    expect((await api().delete(`${P}/profile/picture`).set(emp.auth)).status).toBe(200);
    expect((await api().get(`${P}/profile/picture`).set(emp.auth)).status).toBe(404);
  });
  test('rejects wrong content: text disguised as PNG, extension/MIME mismatch, unsupported type, missing file, oversize', async () => {
    const t = (buf, name, type) => api().put(`${P}/profile/picture`).set(emp.auth).attach('file', buf, { filename: name, contentType: type });
    expect((await t(Buffer.from('<script>alert(1)</script>............'), 'x.png', 'image/png')).status).toBe(400);
    expect((await t(PNG, 'x.png', 'image/jpeg')).status).toBe(400);
    expect((await t(Buffer.from('%PDF-1.7 ..............'), 'x.pdf', 'application/pdf')).status).toBe(400);
    expect((await api().put(`${P}/profile/picture`).set(emp.auth).field('note', 'nofile')).status).toBe(400);
    const big = await t(Buffer.concat([PNG, Buffer.alloc(70000)]), 'big.png', 'image/png');
    expect(big.status).toBe(413); expect(big.body.error.code).toBe('FILE_TOO_LARGE');
  });
  test('only HR can change another employee\'s picture', async () => {
    const o = await makeEmployee({});
    expect((await api().put(`${P}/employees/${o.employeeId}/picture`).set(emp.auth).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(403);
    expect((await api().put(`${P}/employees/${o.employeeId}/picture`).set(hr.auth).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(200);
  });
});

describe('departments, teams, designations', () => {
  test('department CRUD, head assignment, deactivation rules, duplicates', async () => {
    const d = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'FIN', name: 'Finance' })).body.data;
    expect((await api().post(`${P}/departments`).set(hr.auth).send({ code: 'FIN', name: 'Other' })).status).toBe(409);
    const head = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ departmentId: d.id }))).body.data;
    const upd = await api().put(`${P}/departments/${d.id}`).set(hr.auth).send({ headEmployeeId: head.id, description: 'Money' });
    expect(upd.body.data).toMatchObject({ headEmployeeId: head.id, description: 'Money', headcount: 1 });
    expect((await api().put(`${P}/departments/${d.id}`).set(hr.auth).send({ headEmployeeId: emp.employeeId })).status).toBe(422); // not in dept
    expect((await api().delete(`${P}/departments/${d.id}`).set(hr.auth)).status).toBe(409); // not empty
    const e2 = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'TMP', name: 'Temp' })).body.data;
    expect((await api().delete(`${P}/departments/${e2.id}`).set(hr.auth)).body.data.isActive).toBe(false);
    const list = await api().get(`${P}/departments?q=Fin&isActive=true`).set(emp.auth);
    expect(list.body.data.map((x) => x.code)).toEqual(['FIN']);
  });
  test('teams belong to a department; members must match it', async () => {
    const t = (await api().post(`${P}/teams`).set(hr.auth).send({ departmentId: dept.id, name: 'Platform' })).body.data;
    expect((await api().post(`${P}/teams`).set(hr.auth).send({ departmentId: dept.id, name: 'Platform' })).status).toBe(409);
    const inDept = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ departmentId: dept.id }))).body.data;
    const outDept = (await api().post(`${P}/employees`).set(hr.auth).send(newEmployee())).body.data;
    expect((await api().put(`${P}/teams/${t.id}/members`).set(hr.auth).send({ employeeIds: [outDept.id] })).status).toBe(422);
    const ok = await api().put(`${P}/teams/${t.id}/members`).set(hr.auth).send({ employeeIds: [inDept.id] });
    expect(ok.status).toBe(200); expect(ok.body.data.members).toHaveLength(1);
    expect((await api().post(`${P}/employees`).set(hr.auth).send(newEmployee({ departmentId: dept.id, teamId: 99999 }))).status).toBe(422);
    expect((await api().put(`${P}/employees/${outDept.id}`).set(hr.auth).send({ teamId: t.id })).status).toBe(422);
  });
  test('designation CRUD and filtering', async () => {
    const d = (await api().post(`${P}/designations`).set(hr.auth).send({ name: 'Principal', jobLevel: 7 })).body.data;
    expect((await api().post(`${P}/designations`).set(hr.auth).send({ name: 'Principal' })).status).toBe(409);
    expect((await api().put(`${P}/designations/${d.id}`).set(hr.auth).send({ isActive: false })).body.data.isActive).toBe(false);
    expect((await api().get(`${P}/designations?isActive=false`).set(emp.auth)).body.data.map((x) => x.name)).toContain('Principal');
    expect((await api().post(`${P}/designations`).set(emp.auth).send({ name: 'Nope' })).status).toBe(403);
  });
});

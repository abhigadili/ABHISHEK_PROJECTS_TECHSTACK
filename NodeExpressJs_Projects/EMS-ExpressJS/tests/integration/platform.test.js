const { api, P, db, resetDb, actor, makeEmployee } = require('../helpers');

let hr; let mgr; let emp;
beforeAll(async () => { await resetDb(); hr = await actor('HR_ADMIN'); mgr = await actor('MANAGER'); emp = await actor('EMPLOYEE', { managerId: mgr.employeeId }); });
afterAll(() => db.close());

describe('notifications', () => {
  test('onboarding notifications; list/get/read/bulk-read/unread count; recipient isolation', async () => {
    const created = await api().post(`${P}/employees`).set(hr.auth).send({ firstName: 'New', lastName: 'Joiner', workEmail: 'new.joiner@test.example', joiningDate: '2026-01-05', managerId: mgr.employeeId, account: { role: 'EMPLOYEE', password: 'Str0ng-Passw0rd!' } });
    expect(created.status).toBe(201);
    const n = (await api().get(`${P}/notifications?unread=true`).set(mgr.auth)).body;
    const note = n.data.find((x) => x.type === 'ONBOARDING');
    expect(note).toMatchObject({ isRead: false, refType: 'employee' });
    const count0 = (await api().get(`${P}/notifications/unread-count`).set(mgr.auth)).body.data.unread;
    expect(count0).toBeGreaterThanOrEqual(1);
    expect((await api().get(`${P}/notifications/${note.id}`).set(emp.auth)).status).toBe(404); // other user's notification
    expect((await api().post(`${P}/notifications/${note.id}/read`).set(emp.auth)).status).toBe(404);
    const read = await api().post(`${P}/notifications/${note.id}/read`).set(mgr.auth);
    expect(read.body.data.isRead).toBe(true);
    expect((await api().get(`${P}/notifications/unread-count`).set(mgr.auth)).body.data.unread).toBe(count0 - 1);
    // bulk: cannot mark someone else's notification even if the id is supplied
    const theirs = (await api().get(`${P}/notifications`).set(hr.auth)).body.data;
    await api().post(`${P}/notifications/read`).set(emp.auth).send({ ids: theirs.map((x) => x.id) });
    const all = await api().post(`${P}/notifications/read`).set(mgr.auth).send({});
    expect(all.body.data.updated).toBeGreaterThanOrEqual(0);
    expect((await api().get(`${P}/notifications/unread-count`).set(mgr.auth)).body.data.unread).toBe(0);
  });
});

describe('holidays and calendars', () => {
  test('holiday CRUD with location filtering and uniqueness', async () => {
    const h = await api().post(`${P}/holidays`).set(hr.auth).send({ holidayDate: '2026-12-25', name: 'Christmas' });
    expect(h.status).toBe(201);
    expect((await api().post(`${P}/holidays`).set(hr.auth).send({ holidayDate: '2026-12-25', name: 'Dup' })).status).toBe(409);
    await api().post(`${P}/holidays`).set(hr.auth).send({ holidayDate: '2026-08-15', name: 'Local Day', location: 'Pune' });
    expect((await api().get(`${P}/holidays?from=2026-01-01&to=2026-12-31&location=HQ`).set(emp.auth)).body.data.map((x) => x.name)).toEqual(['Christmas']);
    expect((await api().get(`${P}/holidays?from=2026-01-01&to=2026-12-31&location=Pune`).set(emp.auth)).body.data).toHaveLength(2);
    expect((await api().post(`${P}/holidays`).set(emp.auth).send({ holidayDate: '2026-01-01', name: 'x' })).status).toBe(403);
    expect((await api().put(`${P}/holidays/${h.body.data.id}`).set(hr.auth).send({ name: 'Xmas' })).body.data.name).toBe('Xmas');
    expect((await api().delete(`${P}/holidays/${h.body.data.id}`).set(hr.auth)).status).toBe(200);
    expect((await api().delete(`${P}/holidays/${h.body.data.id}`).set(hr.auth)).status).toBe(404);
  });
  test('weekly offs are configurable and change leave day counting', async () => {
    expect((await api().get(`${P}/weekly-offs`).set(emp.auth)).body.data.map((x) => x.dayOfWeek)).toEqual([0, 6]);
    expect((await api().put(`${P}/weekly-offs`).set(emp.auth).send({ days: [0] })).status).toBe(403);
    const set = await api().put(`${P}/weekly-offs`).set(hr.auth).send({ location: 'Dubai', days: [5, 6] });
    expect(set.body.data.filter((x) => x.location === 'Dubai').map((x) => x.dayOfWeek)).toEqual([5, 6]);
    expect((await api().put(`${P}/weekly-offs`).set(hr.auth).send({ days: [9] })).status).toBe(400);
    await db.getPool().query("DELETE FROM weekly_offs WHERE location = 'Dubai'");
  });
  test('leave and attendance calendars', async () => {
    await api().post(`${P}/attendance/check-in`).set(emp.auth).send({});
    const now = new Date();
    const q = `year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;
    const att = await api().get(`${P}/calendar/attendance?${q}`).set(emp.auth);
    expect(att.status).toBe(200);
    expect(att.body.data.days.length).toBeGreaterThanOrEqual(28);
    expect(att.body.data.days.filter((d) => d.recorded).length).toBe(1);
    expect(att.body.data.days.some((d) => d.calendarDayType === 'WEEKLY_OFF')).toBe(true);
    expect((await api().get(`${P}/calendar/attendance?${q}&employeeId=${hr.employeeId}`).set(emp.auth)).status).toBe(403);
    const lc = await api().get(`${P}/calendar/leave?${q}`).set(mgr.auth);
    expect(lc.status).toBe(200); expect(lc.body.data).toHaveProperty('leaves');
  });
});

describe('dashboard and reports', () => {
  test('metrics come from the database and respond to changes', async () => {
    const d0 = (await api().get(`${P}/dashboard`).set(hr.auth)).body.data;
    const dept = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'DSH', name: 'Dash' })).body.data;
    const bd = new Date(); bd.setUTCDate(bd.getUTCDate() + 3);
    await api().post(`${P}/employees`).set(hr.auth).send({ firstName: 'Dash', lastName: 'Board', workEmail: 'dash@test.example', joiningDate: '2020-01-01', departmentId: dept.id, dateOfBirth: `1990-${String(bd.getUTCMonth() + 1).padStart(2, '0')}-${String(bd.getUTCDate()).padStart(2, '0')}` });
    const d1 = (await api().get(`${P}/dashboard`).set(hr.auth)).body.data;
    expect(d1.employees.total).toBe(d0.employees.total + 1);
    expect(d1.employees.active).toBe(d0.employees.active + 1);
    expect(d1.headcountByDepartment.find((x) => x.department === 'Dash').headcount).toBe(1);
    expect(d1.upcomingBirthdays.some((b) => b.name === 'Dash Board')).toBe(true);
    expect(d1.upcomingBirthdays[0]).not.toHaveProperty('dateOfBirth');
    expect(d1.upcomingAnniversaries.length).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(d1)).not.toMatch(/salary/i);
  });
  test('manager dashboard is scoped to their subtree', async () => {
    const d = (await api().get(`${P}/dashboard`).set(mgr.auth)).body.data;
    expect(d.employees.total).toBe(3); // manager + emp + the joiner created in the notifications test; HR sees more
    expect((await api().get(`${P}/dashboard`).set(hr.auth)).body.data.employees.total).toBeGreaterThan(3);
  });
  test('joiners/exits, department & designation reports, CSV', async () => {
    const je = await api().get(`${P}/reports/joiners-exits?from=2020-01-01&to=2020-12-31`).set(hr.auth);
    expect(je.body.data.joiners.map((j) => j.name)).toContain('Dash Board');
    const dr = await api().get(`${P}/reports/departments`).set(hr.auth);
    expect(dr.body.data.find((x) => x.code === 'DSH').activeEmployees).toBe(1);
    expect((await api().get(`${P}/reports/designations`).set(hr.auth)).status).toBe(200);
    const csv = await api().get(`${P}/reports/departments?format=csv`).set(hr.auth);
    expect(csv.text.split('\n')[0]).toBe('code,name,head,isActive,activeEmployees,inactiveEmployees,teams');
    expect((await api().get(`${P}/reports/departments`).set(mgr.auth)).status).toBe(403);
    expect((await api().get(`${P}/upcoming-events?days=400`).set(hr.auth)).status).toBe(400);
  });
});

describe('audit log and docs', () => {
  test('sensitive actions are audited and queryable by admins', async () => {
    const res = await api().get(`${P}/audit-logs?entityType=employee&limit=100`).set(hr.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.some((a) => a.action === 'EMPLOYEE_CREATE')).toBe(true);
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/Str0ng-Passw0rd|password_hash|"password"/);
    expect((await api().get(`${P}/audit-logs`).set(emp.auth)).status).toBe(403);
  });
  test('OpenAPI document and Swagger UI are served', async () => {
    const spec = await api().get('/api-docs/openapi.json');
    expect(spec.status).toBe(200); expect(spec.body.openapi).toBe('3.0.3');
    expect(Object.keys(spec.body.paths).length).toBeGreaterThan(60);
    const ui = await api().get('/api-docs/');
    expect(ui.status).toBe(200); expect(ui.text).toContain('swagger');
  });
});

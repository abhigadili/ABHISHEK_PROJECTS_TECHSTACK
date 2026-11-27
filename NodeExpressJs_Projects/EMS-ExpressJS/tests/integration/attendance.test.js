const { api, P, db, resetDb, actor, makeEmployee } = require('../helpers');
const { localDate } = require('../../src/utils/dates');

let hr; let mgr; let emp; let other;
beforeAll(async () => {
  await resetDb();
  hr = await actor('HR_ADMIN');
  mgr = await actor('MANAGER');
  emp = await actor('EMPLOYEE', { managerId: mgr.employeeId });
  other = await actor('EMPLOYEE');
});
afterAll(() => db.close());

describe('check-in / check-out', () => {
  test('check-out before check-in fails', async () => {
    const res = await api().post(`${P}/attendance/check-out`).set(emp.auth).send({});
    expect(res.status).toBe(409); expect(res.body.error.code).toBe('NOT_CHECKED_IN');
  });
  test('check-in records server time/date, rejects duplicates', async () => {
    const res = await api().post(`${P}/attendance/check-in`).set(emp.auth).send({ workMode: 'REMOTE', remarks: 'wfh', checkInAt: '2000-01-01T00:00:00Z', workDate: '2000-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ workDate: localDate(), status: 'PRESENT', workMode: 'REMOTE', checkOutAt: null });
    expect(new Date(res.body.data.checkInAt).getFullYear()).not.toBe(2000); // client-supplied time ignored
    const dup = await api().post(`${P}/attendance/check-in`).set(emp.auth).send({});
    expect(dup.status).toBe(409); expect(dup.body.error.code).toBe('ALREADY_CHECKED_IN');
  });
  test('concurrent check-ins create exactly one record', async () => {
    const u = await actor('EMPLOYEE');
    const rs = await Promise.all([1, 2, 3, 4].map(() => api().post(`${P}/attendance/check-in`).set(u.auth).send({})));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    const [[c]] = await db.getPool().query('SELECT COUNT(*) c FROM attendance WHERE employee_id = ?', [u.employeeId]);
    expect(c.c).toBe(1);
  });
  test('check-out computes hours server-side; second check-out rejected', async () => {
    await db.getPool().query("UPDATE attendance SET check_in_at = UTC_TIMESTAMP() - INTERVAL 8 HOUR WHERE employee_id = ?", [emp.employeeId]);
    const res = await api().post(`${P}/attendance/check-out`).set(emp.auth).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.workingHours).toBeGreaterThanOrEqual(7.99);
    expect(res.body.data.workingHours).toBeLessThanOrEqual(8.1);
    expect(res.body.data.status).toBe('PRESENT');
    expect((await api().post(`${P}/attendance/check-out`).set(emp.auth).send({})).status).toBe(409);
  });
  test('short day is HALF_DAY, never auto-ABSENT', async () => {
    const u = await actor('EMPLOYEE');
    await api().post(`${P}/attendance/check-in`).set(u.auth).send({});
    const res = await api().post(`${P}/attendance/check-out`).set(u.auth).send({});
    expect(res.body.data.status).toBe('HALF_DAY');
    const [[c]] = await db.getPool().query("SELECT COUNT(*) c FROM attendance WHERE status = 'ABSENT'");
    expect(c.c).toBe(0);
  });
  test('a missing check-in leaves no record (no implicit absence)', async () => {
    const [[c]] = await db.getPool().query('SELECT COUNT(*) c FROM attendance WHERE employee_id = ?', [other.employeeId]);
    expect(c.c).toBe(0);
  });
  test('DB constraint prevents duplicate employee/day rows', async () => {
    await expect(db.getPool().query("INSERT INTO attendance (employee_id, work_date, status) VALUES (?, ?, 'PRESENT')", [emp.employeeId, localDate()])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
});

describe('visibility', () => {
  test('own history; manager sees reports; others forbidden', async () => {
    const mine = await api().get(`${P}/attendance/me`).set(emp.auth);
    expect(mine.body.meta.total).toBe(1);
    const rec = mine.body.data[0];
    expect((await api().get(`${P}/attendance/${rec.id}`).set(emp.auth)).status).toBe(200);
    expect((await api().get(`${P}/attendance/${rec.id}`).set(mgr.auth)).status).toBe(200);
    expect((await api().get(`${P}/attendance/${rec.id}`).set(other.auth)).status).toBe(403);
    expect((await api().get(`${P}/attendance?employeeId=${emp.employeeId}`).set(other.auth)).status).toBe(403);
    const asMgr = await api().get(`${P}/attendance`).set(mgr.auth);
    expect(asMgr.body.data.every((r) => r.employeeId === emp.employeeId)).toBe(true);
    expect((await api().get(`${P}/attendance`).set(hr.auth)).body.meta.total).toBeGreaterThanOrEqual(3);
  });
  test('date-range filter and summary', async () => {
    const none = await api().get(`${P}/attendance/me?from=2000-01-01&to=2000-01-31`).set(emp.auth);
    expect(none.body.meta.total).toBe(0);
    const s = await api().get(`${P}/attendance/summary`).set(emp.auth);
    expect(s.body.data.byStatus.PRESENT).toBe(1);
    expect((await api().get(`${P}/attendance/summary?employeeId=${emp.employeeId}`).set(other.auth)).status).toBe(403);
  });
});

describe('HR corrections', () => {
  test('requires reason; validates order; records audit info; notifies employee', async () => {
    const rec = (await api().get(`${P}/attendance/me`).set(emp.auth)).body.data[0];
    expect((await api().put(`${P}/attendance/${rec.id}`).set(hr.auth).send({ status: 'PRESENT' })).status).toBe(400);
    const bad = await api().put(`${P}/attendance/${rec.id}`).set(hr.auth).send({ checkInAt: '2026-01-02T10:00:00Z', checkOutAt: '2026-01-02T09:00:00Z', reason: 'typo fix' });
    expect(bad.status).toBe(422);
    const ok = await api().put(`${P}/attendance/${rec.id}`).set(hr.auth).send({ checkInAt: '2026-01-02T09:00:00Z', checkOutAt: '2026-01-02T17:30:00Z', reason: 'Forgot to check out' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ workingHours: 8.5, status: 'PRESENT', correction: { correctedBy: hr.userId, reason: 'Forgot to check out' } });
    expect((await api().put(`${P}/attendance/${rec.id}`).set(emp.auth).send({ reason: 'self edit' })).status).toBe(403);
    const n = await api().get(`${P}/notifications?unread=true`).set(emp.auth);
    expect(n.body.data.some((x) => x.type === 'ATTENDANCE_CORRECTED')).toBe(true);
  });
  test('manual entry for another day; duplicate day rejected', async () => {
    const body = { employeeId: other.employeeId, workDate: '2026-03-02', checkInAt: '2026-03-02T09:00:00Z', checkOutAt: '2026-03-02T13:00:00Z', reason: 'Missed punch' };
    const ok = await api().post(`${P}/attendance`).set(hr.auth).send(body);
    expect(ok.status).toBe(201); expect(ok.body.data).toMatchObject({ workingHours: 4, status: 'HALF_DAY', workMode: 'OFFICE' });
    expect((await api().post(`${P}/attendance`).set(hr.auth).send(body)).status).toBe(409);
    expect((await api().post(`${P}/attendance`).set(emp.auth).send(body)).status).toBe(403);
  });
});

describe('reports', () => {
  test('monthly and department reports + CSV', async () => {
    const d = new Date();
    const m = await api().get(`${P}/attendance/reports/monthly?year=2026&month=3`).set(hr.auth);
    expect(m.status).toBe(200);
    expect(m.body.data.rows.find((r) => r.employeeId === other.employeeId)).toMatchObject({ halfDay: 1, totalHours: 4 });
    const csv = await api().get(`${P}/attendance/reports/monthly?year=2026&month=3&format=csv`).set(hr.auth);
    expect(csv.headers['content-type']).toMatch(/text\/csv/); expect(csv.text.split('\n')[0]).toContain('employeeCode');
    expect((await api().get(`${P}/attendance/reports/monthly?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}`).set(emp.auth)).status).toBe(403);
    const dep = await api().get(`${P}/attendance/reports/department?from=2026-03-01&to=2026-03-31`).set(hr.auth);
    expect(dep.status).toBe(200); expect(Array.isArray(dep.body.data.rows)).toBe(true);
    expect((await api().get(`${P}/attendance/reports/department`).set(mgr.auth)).status).toBe(403);
    expect((await api().get(`${P}/attendance/reports/monthly?year=2026&month=13`).set(hr.auth)).status).toBe(400);
  });
});

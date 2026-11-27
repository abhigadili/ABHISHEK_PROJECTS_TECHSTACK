const { api, P, db, resetDb, actor, makeEmployee, nextWeekday, PNG } = require('../helpers');
const { addDays, dayOfWeek } = require('../../src/utils/dates');

let hr; let mgr; let emp; let peer; let type;
// All leave dates live in next calendar year so they are always future-dated and share one balance year.
const Y = new Date().getUTCFullYear() + 1;
const year = () => Y;
const apply = (who, body) => api().post(`${P}/leave/requests`).set(who.auth).send({ leaveTypeId: type.CL, dayPart: 'FULL_DAY', reason: 'Family event', ...body });
const balance = async (who, code = 'CL', y = Y) => (await api().get(`${P}/leave/balances?year=${y}`).set(who.auth)).body.data.balances.find((b) => b.leaveTypeCode === code);
// a Monday at least `n` weeks out
const monday = (n) => { let d = `${Y}-01-01`; while (dayOfWeek(d) !== 1) d = addDays(d, 1); return addDays(d, 7 * (n - 1)); };

beforeAll(async () => {
  await resetDb();
  hr = await actor('HR_ADMIN');
  mgr = await actor('MANAGER');
  emp = await actor('EMPLOYEE', { managerId: mgr.employeeId });
  peer = await actor('EMPLOYEE', { managerId: mgr.employeeId });
  const types = (await api().get(`${P}/leave/types`).set(hr.auth)).body.data;
  type = Object.fromEntries(types.map((t) => [t.code, t.id]));
});
afterAll(() => db.close());

describe('leave types & balances', () => {
  test('seeded types: casual, sick, earned, unpaid; unpaid has no balance', async () => {
    expect(Object.keys(type).sort()).toEqual(['CL', 'EL', 'SL', 'UL']);
    const b = (await api().get(`${P}/leave/balances?year=${Y}`).set(emp.auth)).body.data.balances;
    expect(b.map((x) => x.leaveTypeCode)).toEqual(['CL', 'SL', 'EL']);
    expect(b.find((x) => x.leaveTypeCode === 'CL')).toMatchObject({ entitled: 12, used: 0, available: 12 });
  });
  test('only HR manages types/policies', async () => {
    expect((await api().post(`${P}/leave/types`).set(emp.auth).send({ code: 'X', name: 'X' })).status).toBe(403);
    const t = await api().post(`${P}/leave/types`).set(hr.auth).send({ code: 'COMP', name: 'Comp Off', policy: { annualEntitlement: 4 } });
    expect(t.status).toBe(201); expect(t.body.data.policy.annualEntitlement).toBe(4);
  });
  test('ledger starts with an entitlement entry', async () => {
    const h = (await api().get(`${P}/leave/history?year=${Y}`).set(emp.auth)).body.data;
    expect(h.ledger.filter((l) => l.type === 'ENTITLEMENT').length).toBe(3);
  });
});

describe('applying for leave', () => {
  test('counts working days only: weekends excluded', async () => {
    const mon = monday(3);
    const res = await apply(emp, { startDate: mon, endDate: addDays(mon, 6) }); // Mon..Sun => 5 days
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ days: 5, status: 'PENDING' });
    global.reqFirst = res.body.data;
    await api().post(`${P}/leave/requests/${res.body.data.id}/cancel`).set(emp.auth).send({});
  });
  test('holidays inside the range are excluded', async () => {
    const mon = monday(4);
    await api().post(`${P}/holidays`).set(hr.auth).send({ holidayDate: addDays(mon, 2), name: 'Test Holiday' });
    const res = await apply(emp, { startDate: mon, endDate: addDays(mon, 4) });
    expect(res.body.data.days).toBe(4);
    await api().post(`${P}/leave/requests/${res.body.data.id}/cancel`).set(emp.auth).send({});
  });
  test('half day = 0.5; must be a single day; weekend-only is rejected', async () => {
    const mon = monday(5);
    const h = await apply(emp, { startDate: mon, endDate: mon, dayPart: 'FIRST_HALF' });
    expect(h.body.data.days).toBe(0.5);
    const second = await apply(emp, { startDate: mon, endDate: mon, dayPart: 'SECOND_HALF' }); // other half of same day is allowed
    expect(second.status).toBe(201);
    expect((await apply(emp, { startDate: mon, endDate: mon, dayPart: 'FIRST_HALF' })).status).toBe(409);
    expect((await apply(emp, { startDate: mon, endDate: addDays(mon, 1), dayPart: 'FIRST_HALF' })).status).toBe(422);
    expect((await apply(emp, { startDate: addDays(mon, 5), endDate: addDays(mon, 6) })).body.error.code).toBe('NO_WORKING_DAYS');
    for (const r of [h, second]) await api().post(`${P}/leave/requests/${r.body.data.id}/cancel`).set(emp.auth).send({});
  });
  test('invalid dates, past dates, cross-year, unknown type and missing reason', async () => {
    const mon = monday(6);
    expect((await apply(emp, { startDate: addDays(mon, 3), endDate: mon })).status).toBe(422);
    expect((await apply(emp, { startDate: '2020-01-06', endDate: '2020-01-07' })).status).toBe(422);
    expect((await apply(emp, { startDate: `${year()}-12-30`, endDate: `${year() + 1}-01-02` })).status).toBe(422);
    expect((await apply(emp, { leaveTypeId: 9999, startDate: mon, endDate: mon })).status).toBe(422);
    const v = await apply(emp, { startDate: 'tomorrow', endDate: mon, reason: '' });
    expect(v.status).toBe(400); expect(v.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['startDate', 'reason']));
  });
  test('overlapping requests are rejected, also under concurrency', async () => {
    const mon = monday(7);
    const a = await apply(peer, { startDate: mon, endDate: addDays(mon, 1) });
    expect(a.status).toBe(201);
    expect((await apply(peer, { startDate: addDays(mon, 1), endDate: addDays(mon, 2) })).body.error.code).toBe('OVERLAPPING_LEAVE');
    const racer = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const m2 = monday(8);
    const rs = await Promise.all([1, 2, 3, 4].map(() => apply(racer, { startDate: m2, endDate: m2 })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    await api().post(`${P}/leave/requests/${a.body.data.id}/cancel`).set(peer.auth).send({});
  });
  test('insufficient balance blocked, pending requests count against availability', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const mon = monday(10);
    const big = await apply(u, { startDate: mon, endDate: addDays(mon, 4) }); // 5 of 12
    expect(big.status).toBe(201);
    const big2 = await apply(u, { startDate: addDays(mon, 7), endDate: addDays(mon, 10) }); // 4 more => 9 reserved (max consecutive for CL is 5)
    expect(big2.status).toBe(201);
    const over = await apply(u, { startDate: addDays(mon, 14), endDate: addDays(mon, 18) }); // 5 > 3 left
    expect(over.status).toBe(422); expect(over.body.error.code).toBe('INSUFFICIENT_BALANCE'); expect(over.body.error.details.available).toBe(3);
    const longRun = await apply(u, { startDate: addDays(mon, 21), endDate: addDays(mon, 32) }); // exceeds CL max-consecutive 5
    expect(longRun.body.error.code).toBe('MAX_CONSECUTIVE_EXCEEDED');
  });
  test('unpaid leave is not balance-limited and never deducts', async () => {
    const mon = monday(12);
    const r = await apply(emp, { leaveTypeId: type.UL, startDate: mon, endDate: addDays(mon, 4), reason: 'Sabbatical' });
    expect(r.status).toBe(201);
    const ap = await api().post(`${P}/leave/requests/${r.body.data.id}/approve`).set(mgr.auth).send({});
    expect(ap.status).toBe(200);
    expect((await api().get(`${P}/leave/balances?year=${Y}`).set(emp.auth)).body.data.balances.some((b) => b.leaveTypeCode === 'UL')).toBe(false);
  });
});

describe('approval workflow', () => {
  let r;
  beforeAll(async () => { const mon = monday(14); r = (await apply(emp, { startDate: mon, endDate: addDays(mon, 2) })).body.data; });

  test('manager is notified of new request', async () => {
    const n = (await api().get(`${P}/notifications?unread=true`).set(mgr.auth)).body.data;
    expect(n.some((x) => x.type === 'LEAVE_APPLIED' && x.refId === r.id)).toBe(true);
    expect((await api().get(`${P}/notifications/unread-count`).set(mgr.auth)).body.data.unread).toBeGreaterThan(0);
  });
  test('pending approvals list shows it to the manager and HR, not to a stranger manager', async () => {
    expect((await api().get(`${P}/leave/requests/pending-approvals`).set(mgr.auth)).body.data.map((x) => x.id)).toContain(r.id);
    expect((await api().get(`${P}/leave/requests/pending-approvals`).set(hr.auth)).body.data.map((x) => x.id)).toContain(r.id);
    const stranger = await actor('MANAGER');
    expect((await api().get(`${P}/leave/requests/pending-approvals`).set(stranger.auth)).body.data.map((x) => x.id)).not.toContain(r.id);
    expect((await api().get(`${P}/leave/requests/pending-approvals`).set(emp.auth)).status).toBe(403);
  });
  test('unauthorized approvers are refused: requester, peer, unrelated manager', async () => {
    const stranger = await actor('MANAGER');
    expect((await api().post(`${P}/leave/requests/${r.id}/approve`).set(emp.auth).send({})).status).toBe(403);
    expect((await api().post(`${P}/leave/requests/${r.id}/approve`).set(peer.auth).send({})).status).toBe(403);
    expect((await api().post(`${P}/leave/requests/${r.id}/approve`).set(stranger.auth).send({})).status).toBe(403);
    expect((await api().get(`${P}/leave/requests/${r.id}`).set(stranger.auth)).status).toBe(403);
    expect((await api().get(`${P}/leave/requests/${r.id}`).set(peer.auth)).status).toBe(403);
  });
  test('a manager cannot approve their own leave', async () => {
    const mon = monday(16);
    const own = (await apply(mgr, { startDate: mon, endDate: mon })).body.data;
    expect((await api().post(`${P}/leave/requests/${own.id}/approve`).set(mgr.auth).send({})).status).toBe(403);
    expect((await api().post(`${P}/leave/requests/${own.id}/approve`).set(hr.auth).send({})).status).toBe(200); // HR may
  });
  test('approval deducts balance once, writes ledger, marks attendance, notifies employee', async () => {
    const before = await balance(emp);
    const ok = await api().post(`${P}/leave/requests/${r.id}/approve`).set(mgr.auth).send({ note: 'Enjoy' });
    expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ status: 'APPROVED', decisionNote: 'Enjoy' });
    const after = await balance(emp);
    expect(after.used - before.used).toBe(3); expect(after.available).toBe(before.available - 3);
    const [[tx]] = await db.getPool().query("SELECT COUNT(*) c, SUM(amount) s FROM leave_balance_transactions WHERE leave_request_id = ? AND type = 'DEDUCTION'", [r.id]);
    expect(tx.c).toBe(1); expect(Number(tx.s)).toBe(-3);
    const [[att]] = await db.getPool().query("SELECT COUNT(*) c FROM attendance WHERE employee_id = ? AND status = 'ON_LEAVE'", [emp.employeeId]);
    expect(att.c).toBeGreaterThanOrEqual(3);
    expect((await api().get(`${P}/notifications`).set(emp.auth)).body.data.some((n) => n.type === 'LEAVE_APPROVED')).toBe(true);
  });
  test('repeat approval/rejection is refused and does not double-deduct', async () => {
    const before = await balance(emp);
    const again = await api().post(`${P}/leave/requests/${r.id}/approve`).set(mgr.auth).send({});
    expect(again.status).toBe(409); expect(again.body.error.code).toBe('ALREADY_PROCESSED');
    expect((await api().post(`${P}/leave/requests/${r.id}/reject`).set(mgr.auth).send({})).status).toBe(409);
    expect((await balance(emp)).used).toBe(before.used);
  });
  test('concurrent approvals of the same request deduct exactly once', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const mon = monday(18);
    const req = (await apply(u, { startDate: mon, endDate: addDays(mon, 1) })).body.data;
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => api().post(`${P}/leave/requests/${req.id}/approve`).set(i % 2 ? mgr.auth : hr.auth).send({})));
    expect(rs.filter((x) => x.status === 200)).toHaveLength(1);
    expect(rs.filter((x) => x.status === 409)).toHaveLength(4);
    expect((await balance(u)).used).toBe(2);
    const [[c]] = await db.getPool().query("SELECT COUNT(*) c FROM leave_balance_transactions WHERE leave_request_id = ? AND type = 'DEDUCTION'", [req.id]);
    expect(c.c).toBe(1);
  });
  test('the ledger unique key itself blocks a duplicate deduction', async () => {
    const [[row]] = await db.getPool().query("SELECT leave_balance_id b, leave_request_id r FROM leave_balance_transactions WHERE type = 'DEDUCTION' LIMIT 1");
    await expect(db.getPool().query("INSERT INTO leave_balance_transactions (leave_balance_id, leave_request_id, type, amount) VALUES (?,?,'DEDUCTION',-1)", [row.b, row.r])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
  test('concurrent approvals across different requests never overdraw the balance', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    await db.getPool().query('SELECT 1');
    // shrink the balance to 4 days after two 3-day requests are filed (filing checked against 12)
    const m = monday(22);
    const r1 = (await apply(u, { startDate: m, endDate: addDays(m, 2) })).body.data;
    const r2 = (await apply(u, { startDate: addDays(m, 7), endDate: addDays(m, 9) })).body.data;
    await db.getPool().query("UPDATE leave_balances SET entitled = 4 WHERE employee_id = ? AND leave_type_id = ? AND year = ?", [u.employeeId, type.CL, +m.slice(0, 4)]);
    const rs = await Promise.all([r1, r2].map((x) => api().post(`${P}/leave/requests/${x.id}/approve`).set(mgr.auth).send({})));
    expect(rs.map((x) => x.status).sort()).toEqual([200, 422]);
    const b = await balance(u, 'CL', +m.slice(0, 4));
    expect(b.available).toBe(1); expect(b.used).toBe(3);
  });
  test('rejection does not touch balance; employee is told', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const m = monday(26);
    const req = (await apply(u, { startDate: m, endDate: m })).body.data;
    const rej = await api().post(`${P}/leave/requests/${req.id}/reject`).set(mgr.auth).send({ note: 'Release week' });
    expect(rej.body.data.status).toBe('REJECTED');
    expect((await balance(u)).used).toBe(0);
    expect((await api().get(`${P}/notifications`).set(u.auth)).body.data.some((n) => n.type === 'LEAVE_REJECTED' && n.message.includes('Release week'))).toBe(true);
    expect((await api().post(`${P}/leave/requests/${req.id}/cancel`).set(u.auth).send({})).status).toBe(409);
  });
});

describe('cancellation', () => {
  test('cancelling an approved future request refunds exactly once and clears ON_LEAVE attendance', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const m = monday(30);
    const req = (await apply(u, { startDate: m, endDate: addDays(m, 1) })).body.data;
    await api().post(`${P}/leave/requests/${req.id}/approve`).set(mgr.auth).send({});
    expect((await balance(u, 'CL', +m.slice(0, 4))).used).toBe(2);
    expect((await api().post(`${P}/leave/requests/${req.id}/cancel`).set(peer.auth).send({})).status).toBe(403);
    const rs = await Promise.all([1, 2, 3].map(() => api().post(`${P}/leave/requests/${req.id}/cancel`).set(u.auth).send({})));
    expect(rs.filter((x) => x.status === 200)).toHaveLength(1);
    expect((await balance(u, 'CL', +m.slice(0, 4))).used).toBe(0);
    const [[c]] = await db.getPool().query("SELECT COUNT(*) c FROM attendance WHERE employee_id = ? AND status = 'ON_LEAVE'", [u.employeeId]);
    expect(c.c).toBe(0);
    expect((await api().get(`${P}/notifications`).set(mgr.auth)).body.data.some((n) => n.type === 'LEAVE_CANCELLED')).toBe(true);
  });
  test('pending request withdrawal needs no refund', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const m = monday(32);
    const req = (await apply(u, { startDate: m, endDate: m })).body.data;
    expect((await api().post(`${P}/leave/requests/${req.id}/cancel`).set(u.auth).send({})).body.data.status).toBe('CANCELLED');
    expect((await balance(u)).used).toBe(0);
  });
});

describe('adjustments, history, team and reports', () => {
  test('HR adjusts balances with a ledger entry; employees cannot; cannot go negative', async () => {
    const u = await actor('EMPLOYEE');
    const y = year();
    const adj = (who, amount) => api().post(`${P}/leave/balances/adjust`).set(who.auth).send({ employeeId: u.employeeId, leaveTypeId: type.SL, year: y, amount, note: 'Goodwill' });
    expect((await adj(u, 1)).status).toBe(403);
    const ok = await adj(hr, 2.5);
    expect(ok.status).toBe(200);
    expect(ok.body.data.balances.find((b) => b.leaveTypeCode === 'SL')).toMatchObject({ adjusted: 2.5, available: 12.5 });
    expect((await adj(hr, -100)).body.error.code).toBe('NEGATIVE_BALANCE');
    expect((await api().post(`${P}/leave/balances/adjust`).set(hr.auth).send({ employeeId: u.employeeId, leaveTypeId: type.UL, year: y, amount: 1, note: 'x y z' })).status).toBe(422);
    const hist = (await api().get(`${P}/leave/history/employees/${u.employeeId}?year=${y}`).set(hr.auth)).body.data;
    expect(hist.ledger.some((l) => l.type === 'ADJUSTMENT' && l.amount === 2.5)).toBe(true);
    expect((await api().get(`${P}/leave/history/employees/${u.employeeId}`).set(peer.auth)).status).toBe(403);
  });
  test('team leave shows reports\' leave to the manager', async () => {
    const t = (await api().get(`${P}/leave/team?from=${monday(1)}&to=${monday(40)}`).set(mgr.auth)).body.data;
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((x) => x.employeeId !== mgr.employeeId)).toBe(true);
    expect((await api().get(`${P}/leave/team`).set(emp.auth)).status).toBe(403);
  });
  test('request listing is scoped and filterable', async () => {
    const mine = (await api().get(`${P}/leave/requests?status=APPROVED`).set(emp.auth)).body.data;
    expect(mine.every((x) => x.employeeId === emp.employeeId && x.status === 'APPROVED')).toBe(true);
    const all = (await api().get(`${P}/leave/requests?limit=100`).set(hr.auth)).body;
    expect(new Set(all.data.map((x) => x.employeeId)).size).toBeGreaterThan(2);
    expect((await api().get(`${P}/leave/requests?employeeId=${emp.employeeId}`).set(peer.auth)).status).toBe(403);
    const detail = await api().get(`${P}/leave/requests/${mine[0].id}`).set(mgr.auth);
    expect(detail.status).toBe(200); expect(Array.isArray(detail.body.data.documents)).toBe(true);
  });
  test('reports: leave balances, summary, CSV, role gate', async () => {
    const y = year();
    const lb = await api().get(`${P}/reports/leave-balances?year=${y}`).set(hr.auth);
    expect(lb.status).toBe(200); expect(lb.body.data.rows.length).toBeGreaterThan(0);
    const csv = await api().get(`${P}/reports/leave-balances?year=${y}&format=csv`).set(hr.auth);
    expect(csv.headers['content-type']).toMatch(/csv/); expect(csv.text).toContain('employeeCode');
    const sm = await api().get(`${P}/reports/leave-summary?from=${y}-01-01&to=${y}-12-31`).set(hr.auth);
    expect(sm.body.data.rows.some((x) => x.status === 'APPROVED')).toBe(true);
    expect((await api().get(`${P}/reports/leave-balances`).set(emp.auth)).status).toBe(403);
  });
});

describe('supporting documents', () => {
  test('sick leave can carry a verified PDF/image; spoofed files are rejected; access is scoped', async () => {
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const m = monday(34);
    const req = (await apply(u, { leaveTypeId: type.SL, startDate: m, endDate: addDays(m, 2), reason: 'Flu' })).body.data;
    const good = await api().post(`${P}/leave/requests/${req.id}/documents`).set(u.auth).attach('file', PNG, { filename: 'note.png', contentType: 'image/png' });
    expect(good.status).toBe(201);
    expect((await api().post(`${P}/leave/requests/${req.id}/documents`).set(u.auth).attach('file', Buffer.from('not an image at all'), { filename: 'x.pdf', contentType: 'application/pdf' })).status).toBe(400);
    expect((await api().post(`${P}/leave/requests/${req.id}/documents`).set(peer.auth).attach('file', PNG, { filename: 'n.png', contentType: 'image/png' })).status).toBe(403);
    const dl = await api().get(`${P}/leave/requests/${req.id}/documents/${good.body.data.id}`).set(mgr.auth);
    expect(dl.status).toBe(200); expect(dl.headers['content-type']).toBe('image/png');
    expect((await api().get(`${P}/leave/requests/${req.id}/documents/${good.body.data.id}`).set(peer.auth)).status).toBe(403);
  });
  test('a type that requires a document blocks approval until one is attached', async () => {
    const t = (await api().post(`${P}/leave/types`).set(hr.auth).send({ code: 'MED', name: 'Medical', requiresDocument: true, policy: { annualEntitlement: 5 } })).body.data;
    const u = await actor('EMPLOYEE', { managerId: mgr.employeeId });
    const m = monday(36);
    const req = (await apply(u, { leaveTypeId: t.id, startDate: m, endDate: m, reason: 'Surgery' })).body.data;
    expect((await api().post(`${P}/leave/requests/${req.id}/approve`).set(mgr.auth).send({})).body.error.code).toBe('DOCUMENT_REQUIRED');
    await api().post(`${P}/leave/requests/${req.id}/documents`).set(u.auth).attach('file', PNG, { filename: 'n.png', contentType: 'image/png' });
    expect((await api().post(`${P}/leave/requests/${req.id}/approve`).set(mgr.auth).send({})).status).toBe(200);
  });
});

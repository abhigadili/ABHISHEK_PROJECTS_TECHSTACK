const { api, P, db, resetDb, actor, makeEmployee } = require('../helpers');

let hr; let ceo; let vp; let m1; let a; let b; let solo;
const flat = (nodes) => nodes.flatMap((n) => [n, ...flat(n.subordinates)]);

beforeAll(async () => {
  await resetDb();
  hr = await actor('HR_ADMIN');
  await db.getPool().query('UPDATE employees SET manager_id = NULL WHERE id = ?', [hr.employeeId]);
  const dept = (await api().post(`${P}/departments`).set(hr.auth).send({ code: 'ENG', name: 'Eng' })).body.data;
  ceo = await makeEmployee({ first: 'Ceo', last: 'Boss', departmentId: dept.id });
  vp = await makeEmployee({ first: 'Vee', last: 'Pee', managerId: ceo.employeeId, departmentId: dept.id });
  m1 = await makeEmployee({ first: 'Emm', last: 'One', managerId: vp.employeeId, departmentId: dept.id });
  a = await makeEmployee({ first: 'Ay', last: 'Report', managerId: m1.employeeId, departmentId: dept.id });
  b = await makeEmployee({ first: 'Bee', last: 'Report', managerId: m1.employeeId });
  solo = await makeEmployee({ first: 'Solo', last: 'Nomgr' });
});
afterAll(() => db.close());

describe('hierarchy generation', () => {
  test('full tree is built from the database with nested subordinates', async () => {
    const res = await api().get(`${P}/org-chart`).set(hr.auth);
    expect(res.status).toBe(200);
    const nodes = flat(res.body.data.roots);
    const ceoNode = nodes.find((n) => n.id === ceo.employeeId);
    expect(ceoNode.subordinates.map((n) => n.id)).toEqual([vp.employeeId]);
    expect(nodes.find((n) => n.id === m1.employeeId).subordinates.map((n) => n.id).sort()).toEqual([a.employeeId, b.employeeId].sort());
    expect(res.body.data.roots.some((r) => r.id === solo.employeeId)).toBe(true); // employee without a manager
    expect(nodes.find((n) => n.id === b.employeeId).subordinates).toEqual([]); // without reports
    expect(ceoNode).toMatchObject({ employeeCode: ceo.code, department: { name: 'Eng' }, directReportCount: 1 });
  });
  test('tree reflects database changes (not hardcoded)', async () => {
    const extra = await makeEmployee({ managerId: b.employeeId, first: 'New', last: 'Hire' });
    const sub = await api().get(`${P}/org-chart/employees/${b.employeeId}`).set(hr.auth);
    expect(sub.body.data.roots[0].subordinates.map((n) => n.id)).toEqual([extra.employeeId]);
    await db.getPool().query("UPDATE employees SET status = 'INACTIVE' WHERE id = ?", [extra.employeeId]);
    expect((await api().get(`${P}/org-chart/employees/${b.employeeId}`).set(hr.auth)).body.data.roots[0].subordinates).toEqual([]);
  });
  test('depth limit, subtree from manager, direct reports, reporting chain', async () => {
    const shallow = await api().get(`${P}/org-chart?depth=1`).set(hr.auth);
    const ceoNode = flat(shallow.body.data.roots).find((n) => n.id === ceo.employeeId);
    expect(flat([ceoNode]).map((n) => n.id).sort()).toEqual([ceo.employeeId, vp.employeeId].sort());
    const dr = await api().get(`${P}/org-chart/employees/${m1.employeeId}/direct-reports`).set(hr.auth);
    expect(dr.body.data.map((n) => n.id).sort()).toEqual([a.employeeId, b.employeeId].sort());
    const chain = await api().get(`${P}/org-chart/employees/${a.employeeId}/reporting-chain`).set(hr.auth);
    expect(chain.body.data.chain.map((n) => n.id)).toEqual([m1.employeeId, vp.employeeId, ceo.employeeId]);
    expect(chain.body.data.chain.map((n) => n.level)).toEqual([1, 2, 3]);
    expect((await api().get(`${P}/org-chart/employees/999999/reporting-chain`).set(hr.auth)).status).toBe(404);
  });
  test('search within hierarchy and department scoping', async () => {
    const s = await api().get(`${P}/org-chart/search?q=Report`).set(hr.auth);
    expect(s.body.data.map((n) => n.id).sort()).toEqual([a.employeeId, b.employeeId].sort());
    expect(s.body.data.find((n) => n.id === a.employeeId).managerChainIds).toEqual([m1.employeeId, vp.employeeId, ceo.employeeId]);
    const scoped = await api().get(`${P}/org-chart/search?q=Report&rootId=${vp.employeeId}`).set(hr.auth);
    expect(scoped.body.data).toHaveLength(2);
    const dept = flat((await api().get(`${P}/org-chart?departmentId=${(await db.getPool().query('SELECT id FROM departments LIMIT 1'))[0][0].id}`).set(hr.auth)).body.data.roots);
    expect(dept.some((n) => n.id === solo.employeeId)).toBe(false);
    expect(dept.some((n) => n.id === a.employeeId)).toBe(true);
  });
  test('any authenticated role can read the chart; unauthenticated cannot', async () => {
    const e = await actor('EMPLOYEE');
    expect((await api().get(`${P}/org-chart`).set(e.auth)).status).toBe(200);
    expect((await api().get(`${P}/org-chart`)).status).toBe(401);
  });
});

describe('cycle and self-report prevention', () => {
  test('self as manager is rejected', async () => {
    const res = await api().put(`${P}/employees/${a.employeeId}`).set(hr.auth).send({ managerId: a.employeeId });
    expect(res.status).toBe(422); expect(res.body.error.code).toBe('SELF_REPORTING');
  });
  test('assigning a subordinate (direct or indirect) as manager is rejected', async () => {
    const direct = await api().put(`${P}/employees/${m1.employeeId}`).set(hr.auth).send({ managerId: a.employeeId });
    expect(direct.status).toBe(422); expect(direct.body.error.code).toBe('CIRCULAR_REPORTING');
    const indirect = await api().put(`${P}/employees/${ceo.employeeId}`).set(hr.auth).send({ managerId: a.employeeId });
    expect(indirect.status).toBe(422); expect(indirect.body.error.code).toBe('CIRCULAR_REPORTING');
    const [[row]] = await db.getPool().query('SELECT manager_id FROM employees WHERE id = ?', [ceo.employeeId]);
    expect(row.manager_id).toBeNull();
  });
  test('a legal re-parent works, is recorded in history, and notifies', async () => {
    const res = await api().put(`${P}/employees/${b.employeeId}`).set(hr.auth).send({ managerId: vp.employeeId });
    expect(res.status).toBe(200); expect(res.body.data.manager.id).toBe(vp.employeeId);
    const hist = (await api().get(`${P}/employees/${b.employeeId}/job-history`).set(hr.auth)).body.data;
    expect(hist[0]).toMatchObject({ changeType: 'MANAGER_CHANGE' });
    const [[n]] = await db.getPool().query("SELECT COUNT(*) c FROM notifications WHERE type = 'ORG_CHANGE'");
    expect(n.c).toBeGreaterThanOrEqual(0);
  });
  test('legacy corrupt data (a reporting cycle) does not hang the API and is reported', async () => {
    const x = await makeEmployee({ first: 'Cyc', last: 'X' });
    const y = await makeEmployee({ first: 'Cyc', last: 'Y', managerId: x.employeeId });
    const z = await makeEmployee({ first: 'Cyc', last: 'Z', managerId: y.employeeId });
    await db.getPool().query('UPDATE employees SET manager_id = ? WHERE id = ?', [z.employeeId, x.employeeId]); // x->z->y->x
    const full = await api().get(`${P}/org-chart`).set(hr.auth);
    expect(full.status).toBe(200);
    expect(full.body.data.warnings.unreachableEmployees.map((e) => e.id).sort()).toEqual([x.employeeId, y.employeeId, z.employeeId].sort());
    const sub = await api().get(`${P}/org-chart/employees/${x.employeeId}`).set(hr.auth);
    expect(sub.status).toBe(200);
    expect(flat(sub.body.data.roots)).toHaveLength(3); // each visited once
    expect((await api().get(`${P}/org-chart/employees/${x.employeeId}/reporting-chain`).set(hr.auth)).status).toBe(200);
    // and the app refuses to extend the broken structure
    expect((await api().put(`${P}/employees/${x.employeeId}`).set(hr.auth).send({ managerId: y.employeeId })).status).toBe(422);
  });
});

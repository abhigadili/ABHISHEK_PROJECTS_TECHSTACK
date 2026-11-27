const { api, P, db, resetDb, actor, makeEmployee, login, PASSWORD } = require('../helpers');

beforeAll(resetDb);
afterAll(() => db.close());

describe('login', () => {
  let user;
  beforeAll(async () => { user = await makeEmployee({ role: 'EMPLOYEE' }); });

  test('succeeds and returns tokens without sensitive data', async () => {
    const res = await api().post(`${P}/auth/login`).send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { tokenType: 'Bearer', user: { role: 'EMPLOYEE' } } });
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    const payload = JSON.parse(Buffer.from(res.body.data.accessToken.split('.')[1], 'base64url').toString());
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']); // no email/PII in JWT
  });
  test('wrong password and unknown user get the same generic 401', async () => {
    const a = await api().post(`${P}/auth/login`).send({ email: user.email, password: 'Wrong-Passw0rd!' });
    const b = await api().post(`${P}/auth/login`).send({ email: 'nobody@test.example', password: 'Wrong-Passw0rd!' });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });
  test('validation errors are structured', async () => {
    const res = await api().post(`${P}/auth/login`).send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });
  test('deactivated account cannot log in nor use an existing token', async () => {
    const u = await actor('EMPLOYEE');
    await db.getPool().query('UPDATE users SET is_active = 0 WHERE id = ?', [u.userId]);
    expect((await api().get(`${P}/auth/me`).set(u.auth)).status).toBe(401);
    expect((await api().post(`${P}/auth/login`).send({ email: u.email, password: PASSWORD })).status).toBe(401);
  });
});

describe('protected routes', () => {
  test('missing / malformed / forged token -> 401', async () => {
    expect((await api().get(`${P}/auth/me`)).status).toBe(401);
    expect((await api().get(`${P}/auth/me`).set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    expect((await api().get(`${P}/employees`)).status).toBe(401);
  });
  test('me returns the linked employee', async () => {
    const u = await actor('MANAGER');
    const res = await api().get(`${P}/auth/me`).set(u.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: u.email, role: 'MANAGER', employee: { employeeCode: u.code } });
  });
});

describe('refresh tokens', () => {
  test('rotate, reject reuse, and revoke the whole family on reuse', async () => {
    const u = await actor('EMPLOYEE');
    const r1 = await api().post(`${P}/auth/refresh`).send({ refreshToken: u.refreshToken });
    expect(r1.status).toBe(200);
    const second = r1.body.data.refreshToken;
    expect(second).not.toBe(u.refreshToken);
    const reuse = await api().post(`${P}/auth/refresh`).send({ refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401); expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    expect((await api().post(`${P}/auth/refresh`).send({ refreshToken: second })).status).toBe(401); // family revoked
  });
  test('stored hashed, never plaintext', async () => {
    const u = await actor('EMPLOYEE');
    const [rows] = await db.getPool().query('SELECT token_hash FROM refresh_tokens WHERE user_id = ?', [u.userId]);
    expect(rows[0].token_hash).toHaveLength(64);
    expect(rows.some((r) => r.token_hash === u.refreshToken)).toBe(false);
  });
  test('logout revokes the refresh token; concurrent refresh yields exactly one success', async () => {
    const u = await actor('EMPLOYEE');
    expect((await api().post(`${P}/auth/logout`).send({ refreshToken: u.refreshToken })).status).toBe(200);
    expect((await api().post(`${P}/auth/refresh`).send({ refreshToken: u.refreshToken })).status).toBe(401);
    const v = await actor('EMPLOYEE');
    const results = await Promise.all([1, 2, 3].map(() => api().post(`${P}/auth/refresh`).send({ refreshToken: v.refreshToken })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });
});

describe('password workflows', () => {
  test('forgot/reset: single-use token, old password dies, sessions revoked', async () => {
    const u = await actor('EMPLOYEE');
    const f = await api().post(`${P}/auth/forgot-password`).send({ email: u.email });
    expect(f.status).toBe(200);
    const token = f.body.data.resetToken;
    const newPw = 'Brand-New-Passw0rd!';
    expect((await api().post(`${P}/auth/reset-password`).send({ token, newPassword: 'weak' })).status).toBe(400);
    expect((await api().post(`${P}/auth/reset-password`).send({ token, newPassword: newPw })).status).toBe(200);
    expect((await api().post(`${P}/auth/reset-password`).send({ token, newPassword: 'Another-Passw0rd!' })).status).toBe(400); // single use
    expect((await api().post(`${P}/auth/login`).send({ email: u.email, password: PASSWORD })).status).toBe(401);
    expect((await api().post(`${P}/auth/login`).send({ email: u.email, password: newPw })).status).toBe(200);
    expect((await api().post(`${P}/auth/refresh`).send({ refreshToken: u.refreshToken })).status).toBe(401);
  });
  test('forgot-password does not reveal whether the email exists', async () => {
    const res = await api().post(`${P}/auth/forgot-password`).send({ email: 'ghost@test.example' });
    expect(res.status).toBe(200); expect(res.body.data).toBeNull();
  });
  test('expired reset token is rejected', async () => {
    const u = await actor('EMPLOYEE');
    const token = (await api().post(`${P}/auth/forgot-password`).send({ email: u.email })).body.data.resetToken;
    await db.getPool().query("UPDATE password_reset_tokens SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE user_id = ?", [u.userId]);
    expect((await api().post(`${P}/auth/reset-password`).send({ token, newPassword: 'Brand-New-Passw0rd!' })).status).toBe(400);
  });
  test('change-password checks current password, policy and revokes sessions', async () => {
    const u = await actor('EMPLOYEE');
    expect((await api().post(`${P}/auth/change-password`).set(u.auth).send({ currentPassword: 'nope', newPassword: 'Brand-New-Passw0rd!' })).status).toBe(400);
    expect((await api().post(`${P}/auth/change-password`).set(u.auth).send({ currentPassword: PASSWORD, newPassword: 'weak' })).status).toBe(400);
    expect((await api().post(`${P}/auth/change-password`).set(u.auth).send({ currentPassword: PASSWORD, newPassword: 'Brand-New-Passw0rd!' })).status).toBe(200);
    expect((await api().post(`${P}/auth/refresh`).send({ refreshToken: u.refreshToken })).status).toBe(401);
    expect((await login(u.email, 'Brand-New-Passw0rd!')).accessToken).toBeTruthy();
  });
});

describe('role-based authorization', () => {
  test('role matrix on representative endpoints', async () => {
    const [sa, hr, mgr, emp] = await Promise.all(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'].map((r) => actor(r)));
    const status = async (a, method, path) => (await api()[method](`${P}${path}`).set(a.auth).send({})).status;
    // employee creation: admins only (validation 400 proves the authz gate was passed)
    expect(await status(emp, 'post', '/employees')).toBe(403);
    expect(await status(mgr, 'post', '/employees')).toBe(403);
    expect(await status(hr, 'post', '/employees')).toBe(400);
    expect(await status(sa, 'post', '/employees')).toBe(400);
    // reports/dashboard: manager and up
    expect(await status(emp, 'get', '/dashboard')).toBe(403);
    expect(await status(mgr, 'get', '/dashboard')).toBe(200);
    // audit logs: admins only
    expect(await status(mgr, 'get', '/audit-logs')).toBe(403);
    expect(await status(hr, 'get', '/audit-logs')).toBe(200);
    // role changes: SUPER_ADMIN only
    expect(await status(hr, 'put', `/employees/${emp.employeeId}/role`)).toBe(403);
    expect((await api().put(`${P}/employees/${emp.employeeId}/role`).set(sa.auth).send({ role: 'MANAGER' })).status).toBe(200);
    // department write: admins only
    expect(await status(mgr, 'post', '/departments')).toBe(403);
  });
});

describe('error handling', () => {
  test('unknown route -> JSON 404, malformed JSON -> 400, no stack traces', async () => {
    const u = await actor('EMPLOYEE');
    const nf = await api().get(`${P}/nope`).set(u.auth);
    expect(nf.status).toBe(404); expect(nf.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    const bad = await api().post(`${P}/auth/login`).set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400); expect(bad.body.error.code).toBe('MALFORMED_JSON');
    expect(JSON.stringify(bad.body)).not.toMatch(/at .*\.js|node_modules/);
  });
  test('every response carries a request id; health works; security headers on', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  test('non-numeric id is a validation error, not a 500', async () => {
    const u = await actor('EMPLOYEE');
    expect((await api().get(`${P}/employees/abc`).set(u.auth)).status).toBe(400);
  });
});

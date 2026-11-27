import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API, PNG, PW, app, client, login, memberBody, newMember, uniq, admin } from './helpers';
import { exec, queryOne } from '../src/lib/db';

describe('registration', () => {
  it('registers a member without a picture, with a generated unique member id', async () => {
    const c = client();
    const r = await c.post('/auth/register').send(memberBody());
    expect(r.status).toBe(201);
    expect(r.body.data.user.role).toBe('member');
    expect(r.body.data.user.memberCode).toMatch(/^LM\d{4}\d{6}$/);
    expect(r.body.data.user.hasPicture).toBe(false);
    expect(r.body.data.user).not.toHaveProperty('password_hash');
    const row = await queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [r.body.data.user.id]);
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);          // hashed, never plaintext
    expect((await c.get('/auth/me')).status).toBe(200);         // auto-login via session cookie
  });

  it('registers with a profile picture (multipart) and stores the bytes in MySQL', async () => {
    const body = memberBody();
    const r = await request(app).post(`${API}/auth/register`).set('X-LMS-Client', 'web')
      .field(body as Record<string, string>).attach('picture', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(r.status).toBe(201);
    expect(r.body.data.user.hasPicture).toBe(true);
    const row = await queryOne<any>('SELECT mime_type, size_bytes, LENGTH(data) AS len, data FROM user_images WHERE user_id = ?', [r.body.data.user.id]);
    expect(row.mime_type).toBe('image/png');
    expect(row.len).toBe(PNG.length);
    expect(Buffer.compare(row.data, PNG)).toBe(0);
  });

  it('rejects a non-image disguised as PNG', async () => {
    const r = await request(app).post(`${API}/auth/register`).set('X-LMS-Client', 'web')
      .field(memberBody() as Record<string, string>).attach('picture', Buffer.from('this is definitely not a png file'), { filename: 'x.png', contentType: 'image/png' });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/valid JPEG, PNG or WebP/);
  });

  it('rejects oversized images and disallowed mime types', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(250_000)]);
    const r1 = await request(app).post(`${API}/auth/register`).set('X-LMS-Client', 'web')
      .field(memberBody() as Record<string, string>).attach('picture', big, { filename: 'big.png', contentType: 'image/png' });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post(`${API}/auth/register`).set('X-LMS-Client', 'web')
      .field(memberBody() as Record<string, string>).attach('picture', Buffer.from('GIF89a......'), { filename: 'x.gif', contentType: 'image/gif' });
    expect(r2.status).toBe(400);
  });

  it('validates fields and returns per-field errors', async () => {
    const r = await client().post('/auth/register').send(memberBody({ email: 'nope', password: 'short', confirmPassword: 'other', fullName: '' }));
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.details)).toEqual(expect.arrayContaining(['email', 'password', 'fullName']));
    const r2 = await client().post('/auth/register').send(memberBody({ confirmPassword: 'Different#1A' }));
    expect(r2.body.error.details.confirmPassword).toBe('Passwords do not match');
  });

  it('prevents duplicate emails (case-insensitive)', async () => {
    const m = await newMember();
    const r = await client().post('/auth/register').send(memberBody({ email: m.email.toUpperCase() }));
    expect(r.status).toBe(409);
  });

  it('never lets a visitor choose a privileged role', async () => {
    const r = await client().post('/auth/register').send(memberBody({ role: 'admin', roleId: 1, role_id: 1 }));
    expect(r.status).toBe(201);
    expect(r.body.data.user.role).toBe('member');
  });
});

describe('login / logout / sessions', () => {
  it('logs in, exposes /me, and logout invalidates the session server-side', async () => {
    const m = await newMember();
    const c = await login(m.email);
    expect((await c.get('/auth/me')).body.data.user.email).toBe(m.email);
    expect((await c.post('/auth/logout')).status).toBe(200);
    expect((await c.get('/auth/me')).status).toBe(401);
    const row = await queryOne<any>('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', [m.id]);
    expect(row.n).toBe(1);   // only the registration session remains; the login one was deleted
  });

  it('sets an httpOnly, SameSite cookie and stores only a hash of the token', async () => {
    const m = await newMember();
    const r = await client().post('/auth/login').send({ email: m.email, password: PW });
    const sc = String(r.headers['set-cookie']);
    expect(sc).toMatch(/lms_session=/); expect(sc).toMatch(/HttpOnly/i); expect(sc).toMatch(/SameSite=Lax/i);
    const token = /lms_session=([^;]+)/.exec(sc)![1];
    expect(await queryOne('SELECT 1 FROM sessions WHERE id = ?', [token])).toBeNull();
  });

  it('fails generically for wrong password and unknown email', async () => {
    const m = await newMember();
    const a = await client().post('/auth/login').send({ email: m.email, password: 'Wrong#Pass1' });
    const b = await client().post('/auth/login').send({ email: 'ghost@example.org', password: 'Wrong#Pass1' });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('locks the account after repeated failures (brute-force protection)', async () => {
    const m = await newMember();
    for (let i = 0; i < 5; i++) expect((await client().post('/auth/login').send({ email: m.email, password: 'Bad#Pass123' })).status).toBe(401);
    const locked = await client().post('/auth/login').send({ email: m.email, password: PW });
    expect(locked.status).toBe(429);
    await exec('UPDATE users SET locked_until = NULL WHERE id = ?', [m.id]);
    expect((await client().post('/auth/login').send({ email: m.email, password: PW })).status).toBe(200);
  });

  it('blocks suspended accounts and kills their live sessions', async () => {
    const m = await newMember(); const a = await admin();
    expect((await m.c.get('/auth/me')).status).toBe(200);
    expect((await a.post(`/members/${m.id}/status`).send({ status: 'suspended', reason: 'test' })).status).toBe(200);
    expect((await m.c.get('/auth/me')).status).toBe(401);
    const r = await client().post('/auth/login').send({ email: m.email, password: PW });
    expect(r.status).toBe(403);
    await a.post(`/members/${m.id}/status`).send({ status: 'active' });
    expect((await client().post('/auth/login').send({ email: m.email, password: PW })).status).toBe(200);
  });

  it('requires the CSRF header on state-changing requests', async () => {
    const r = await request(app).post(`${API}/auth/login`).send({ email: 'a@b.co', password: 'x' });
    expect(r.status).toBe(403);
  });
});

describe('password management', () => {
  it('changes the password (needs the current one) and revokes other sessions', async () => {
    const m = await newMember(); const other = await login(m.email);
    const bad = await m.c.post('/auth/change-password').send({ currentPassword: 'nope', newPassword: 'Newer#Pass1', confirmPassword: 'Newer#Pass1' });
    expect(bad.status).toBe(400);
    const ok = await m.c.post('/auth/change-password').send({ currentPassword: PW, newPassword: 'Newer#Pass1', confirmPassword: 'Newer#Pass1' });
    expect(ok.status).toBe(200);
    expect((await other.get('/auth/me')).status).toBe(401);
    expect((await m.c.get('/auth/me')).status).toBe(200);
    expect((await client().post('/auth/login').send({ email: m.email, password: 'Newer#Pass1' })).status).toBe(200);
  });

  it('forgot/reset: single-use token, expiry, generic response, hashed at rest', async () => {
    const m = await newMember();
    const unknown = await client().post('/auth/forgot-password').send({ email: 'nobody@example.org' });
    expect(unknown.status).toBe(200); expect(unknown.body.data).not.toHaveProperty('devResetLink');
    const f = await client().post('/auth/forgot-password').send({ email: m.email });
    const token = new URL(f.body.data.devResetLink).searchParams.get('token')!;
    expect(await queryOne('SELECT 1 FROM password_reset_tokens WHERE token_hash = ?', [token])).toBeNull();
    const r = await client().post('/auth/reset-password').send({ token, newPassword: 'Reset#Pass9', confirmPassword: 'Reset#Pass9' });
    expect(r.status).toBe(200);
    expect((await client().post('/auth/reset-password').send({ token, newPassword: 'Again#Pass9', confirmPassword: 'Again#Pass9' })).status).toBe(400);
    expect((await m.c.get('/auth/me')).status).toBe(401);
    expect((await client().post('/auth/login').send({ email: m.email, password: 'Reset#Pass9' })).status).toBe(200);

    const f2 = await client().post('/auth/forgot-password').send({ email: m.email });
    const t2 = new URL(f2.body.data.devResetLink).searchParams.get('token')!;
    await exec('UPDATE password_reset_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE user_id = ? AND used_at IS NULL', [m.id]);
    expect((await client().post('/auth/reset-password').send({ token: t2, newPassword: 'Late#Pass99', confirmPassword: 'Late#Pass99' })).status).toBe(400);
  });
});
void uniq;

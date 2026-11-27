import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app';
import { exec, query, queryOne } from '../src/lib/db';

export const app = createApp();
// One real listening server for all agents (supertest otherwise spins up a server per request).
const server = http.createServer(app).listen(0, '127.0.0.1');
export const PW = 'Test#Pass123';
export const API = '/api/v1';

/** supertest agent that keeps the session cookie and always sends the CSRF header. */
export function client() {
  const agent = request.agent(server);
  const wrap = (m: 'get' | 'post' | 'put' | 'patch' | 'delete') => (url: string) => agent[m](API + url).set('X-LMS-Client', 'web');
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete'), raw: agent };
}
export type Client = ReturnType<typeof client>;

export async function login(email: string, password = PW) {
  const c = client();
  const r = await c.post('/auth/login').send({ email, password });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return c;
}
export const admin = () => login('admin@library.local');
export const librarian = () => login('librarian@library.local');

let seq = 0;
export const uniq = (p = 'x') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

// 1x1 PNG / minimal JPEG / WebP headers - enough for content sniffing.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary'), Buffer.from([0xff, 0xd9])]);
export const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);

export const memberBody = (over: Record<string, unknown> = {}) => ({
  fullName: 'Test Member', email: `${uniq('m')}@example.org`, phone: '+1 555 0101', password: PW, confirmPassword: PW,
  address: '12 Main St', city: 'Springfield', postalCode: '12345', country: 'USA', ...over,
});

/** Register a member through the public API and return a logged-in client + ids. */
export async function newMember(over: Record<string, unknown> = {}) {
  const c = client();
  const body = memberBody(over);
  const r = await c.post('/auth/register').send(body);
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
  return { c, id: r.body.data.user.id as number, email: body.email as string, code: r.body.data.user.memberCode as string };
}

export async function newBook(staff: Client, over: Record<string, unknown> = {}) {
  const author = await queryOne<any>('SELECT id FROM authors ORDER BY id LIMIT 1');
  const r = await staff.post('/books').send({ title: uniq('Book '), authorIds: [author.id], copies: 1, ...over });
  if (r.status !== 201) throw new Error(`book create failed: ${JSON.stringify(r.body)}`);
  return r.body.data as { id: number; title: string };
}
export const copiesOf = (bookId: number) => query<any>('SELECT * FROM book_copies WHERE book_id = ? ORDER BY id', [bookId]);
export const setDue = (loanId: number, daysAgo: number) =>
  exec('UPDATE loans SET due_date = DATE_SUB(UTC_DATE(), INTERVAL ? DAY) WHERE id = ?', [daysAgo, loanId]);
export async function issue(staff: Client, memberId: number, bookId: number) {
  const r = await staff.post('/loans/issue').send({ memberId, bookId });
  if (r.status !== 201) throw new Error(`issue failed: ${JSON.stringify(r.body)}`);
  return r.body.data as { id: number; copyId: number; dueDate: string };
}

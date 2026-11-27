import { describe, expect, it } from 'vitest';
import { admin, copiesOf, issue, librarian, newBook, newMember, setDue, uniq } from './helpers';
import { exec, query, queryOne } from '../src/lib/db';
import { runMaintenance } from '../src/jobs/maintenance';
import { addDays, todayStr } from '../src/lib/dates';

describe('issue', () => {
  it('issues an available copy: due date from policy, copy on_loan, staff recorded, member notified', async () => {
    const lib = await librarian(); const b = await newBook(lib); const m = await newMember();
    const loan = await issue(lib, m.id, b.id);
    expect(loan.dueDate).toBe(addDays(todayStr(), 14));
    const row = await queryOne<any>('SELECT * FROM loans WHERE id = ?', [loan.id]);
    expect(row).toMatchObject({ user_id: m.id, book_id: b.id, status: 'active', renewal_count: 0 }); expect(row.issued_by).toBeTruthy();
    expect((await copiesOf(b.id))[0].status).toBe('on_loan');
    const n = await queryOne<any>("SELECT * FROM notifications WHERE user_id = ? AND type = 'loan_issued'", [m.id]); expect(n.message).toContain(b.title);
  });

  it('only staff may issue; copy and member rules are enforced', async () => {
    const lib = await librarian(); const b = await newBook(lib); const m = await newMember(); const m2 = await newMember();
    expect((await m.c.post('/loans/issue').send({ memberId: m.id, bookId: b.id })).status).toBe(403);
    await issue(lib, m.id, b.id);
    expect((await lib.post('/loans/issue').send({ memberId: m2.id, bookId: b.id })).status).toBe(422);                // no copy left
    expect((await lib.post('/loans/issue').send({ memberId: m.id, copyId: (await copiesOf(b.id))[0].id })).status).toBe(422);
    const b2 = await newBook(lib, { copies: 2 });
    await issue(lib, m.id, b2.id);
    expect((await lib.post('/loans/issue').send({ memberId: m.id, bookId: b2.id })).body.error.message).toMatch(/already has this book/);
    expect((await lib.post('/loans/issue').send({ memberId: 99999, bookId: b2.id })).status).toBe(404);
    expect((await lib.post('/loans/issue').send({ bookId: b2.id })).status).toBe(400);
    const byCode = await lib.post('/loans/issue').send({ memberCode: m2.code, accessionNumber: (await copiesOf(b2.id))[1].accession_number });
    expect(byCode.status).toBe(201);
  });

  it('enforces the borrowing limit and leaves the copy untouched when an issue is rejected (rollback)', async () => {
    const lib = await librarian(); const m = await newMember({ memberTypeId: 1 });         // Student: 5 loans
    for (let i = 0; i < 5; i++) await issue(lib, m.id, (await newBook(lib)).id);
    const extra = await newBook(lib);
    const r = await lib.post('/loans/issue').send({ memberId: m.id, bookId: extra.id });
    expect(r.status).toBe(422); expect(r.body.error.message).toMatch(/limit/i);
    expect((await copiesOf(extra.id))[0].status).toBe('available');
    expect((await queryOne<any>('SELECT COUNT(*) n FROM loans WHERE book_id = ?', [extra.id])).n).toBe(0);
  });

  it('never double-issues one physical copy under concurrent requests', async () => {
    const lib = await librarian(); const b = await newBook(lib, { copies: 1 });
    const ms = await Promise.all([newMember(), newMember(), newMember(), newMember()]);
    const results = await Promise.all(ms.map((m) => lib.post('/loans/issue').send({ memberId: m.id, bookId: b.id })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await queryOne<any>("SELECT COUNT(*) n FROM loans WHERE book_id = ? AND status = 'active'", [b.id])).n).toBe(1);
  });

  it('enforces the member limit under concurrent issues to the same member', async () => {
    const lib = await librarian(); const m = await newMember({ memberTypeId: 1 });
    const books = await Promise.all(Array.from({ length: 8 }, () => newBook(lib)));
    const rs = await Promise.all(books.map((b) => lib.post('/loans/issue').send({ memberId: m.id, bookId: b.id })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(5);
    expect((await queryOne<any>("SELECT COUNT(*) n FROM loans WHERE user_id = ? AND status = 'active'", [m.id])).n).toBe(5);
  });

  it('blocks suspended and expired members, overdue holders and members with too many unpaid fines', async () => {
    const lib = await librarian(); const a = await admin();
    const sus = await newMember(); await a.post(`/members/${sus.id}/status`).send({ status: 'suspended', reason: 'x' });
    expect((await lib.post('/loans/issue').send({ memberId: sus.id, bookId: (await newBook(lib)).id })).status).toBe(422);

    const exp = await newMember();
    await exec("UPDATE memberships SET end_date = DATE_SUB(UTC_DATE(), INTERVAL 2 DAY) WHERE user_id = ?", [exp.id]);
    const e = await lib.post('/loans/issue').send({ memberId: exp.id, bookId: (await newBook(lib)).id });
    expect(e.status).toBe(422); expect(e.body.error.message).toMatch(/expired/);
    expect((await a.post(`/members/${exp.id}/membership`).send({ memberTypeId: 3 })).status).toBe(200);     // renewal restores borrowing
    expect((await lib.post('/loans/issue').send({ memberId: exp.id, bookId: (await newBook(lib)).id })).status).toBe(201);

    const od = await newMember(); const l = await issue(lib, od.id, (await newBook(lib)).id); await setDue(l.id, 2);
    expect((await lib.post('/loans/issue').send({ memberId: od.id, bookId: (await newBook(lib)).id })).body.error.message).toMatch(/overdue/);

    const debtor = await newMember();
    await lib.post('/fines').send({ memberId: debtor.id, amount: 12, reason: 'Test fine' });
    expect((await lib.post('/loans/issue').send({ memberId: debtor.id, bookId: (await newBook(lib)).id })).body.error.message).toMatch(/Outstanding fines/);
    await lib.post('/payments').send({ memberId: debtor.id, amount: 12 });
    expect((await lib.post('/loans/issue').send({ memberId: debtor.id, bookId: (await newBook(lib)).id })).status).toBe(201);
  });

  it('maintenance marks lapsed memberships expired and borrowing then stops', async () => {
    const lib = await librarian(); const m = await newMember();
    await exec("UPDATE memberships SET end_date = DATE_SUB(UTC_DATE(), INTERVAL 1 DAY) WHERE user_id = ?", [m.id]);
    const out = await runMaintenance(); expect(out.membershipsExpired).toBeGreaterThanOrEqual(1);
    expect((await queryOne<any>('SELECT status FROM memberships WHERE user_id = ?', [m.id])).status).toBe('expired');
    expect((await queryOne<any>("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND type = 'membership_expired'", [m.id])).n).toBe(1);
    expect((await lib.post('/loans/issue').send({ memberId: m.id, bookId: (await newBook(lib)).id })).status).toBe(422);
    await runMaintenance();   // idempotent
    expect((await queryOne<any>("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND type = 'membership_expired'", [m.id])).n).toBe(1);
  });
});

describe('return and fines', () => {
  it('returns a copy on time: no fine, copy available again, history preserved', async () => {
    const lib = await librarian(); const b = await newBook(lib); const m = await newMember();
    const loan = await issue(lib, m.id, b.id);
    const r = await lib.post('/loans/return').send({ loanId: loan.id });
    expect(r.status).toBe(200); expect(r.body.data.fines).toEqual([]); expect(r.body.data.loan.status).toBe('returned');
    expect((await copiesOf(b.id))[0].status).toBe('available');
    expect((await lib.post('/loans/return').send({ loanId: loan.id })).status).toBe(422);
    expect((await queryOne<any>('SELECT returned_processed_by, returned_at FROM loans WHERE id = ?', [loan.id])).returned_at).toBeTruthy();
    const acc = (await copiesOf(b.id))[0].accession_number;
    const l2 = await issue(lib, m.id, b.id);
    expect((await lib.post('/loans/return').send({ accessionNumber: acc })).body.data.loan.id).toBe(l2.id);        // return by scanning accession number
    expect((await query('SELECT id FROM loans WHERE book_id = ?', [b.id]))).toHaveLength(2);
  });

  it('calculates overdue fines from policy: per-day rate, no grace for General, per-loan cap', async () => {
    const lib = await librarian(); const m = await newMember(); const b = await newBook(lib);
    const loan = await issue(lib, m.id, b.id); await setDue(loan.id, 5);
    const listed = await lib.get(`/loans?status=overdue&q=${encodeURIComponent(b.title)}`);
    expect(listed.body.data[0]).toMatchObject({ isOverdue: true, daysLate: 5, estimatedFine: 2.5, displayStatus: 'overdue' });
    const r = await lib.post('/loans/return').send({ loanId: loan.id });
    expect(r.body.data.fines).toEqual([{ type: 'overdue', amount: 2.5 }]); expect(r.body.data.daysOverdue).toBe(5);
    const fine = await queryOne<any>('SELECT * FROM fines WHERE loan_id = ?', [loan.id]);
    expect(fine).toMatchObject({ user_id: m.id, fine_type: 'overdue', amount: 2.5, paid_amount: 0, status: 'outstanding' });
    expect((await queryOne<any>("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND type = 'fine_created'", [m.id])).n).toBe(1);

    const b2 = await newBook(lib); const l2 = await issue(lib, m.id, b2.id); await setDue(l2.id, 100);
    expect((await lib.post('/loans/return').send({ loanId: l2.id })).body.data.fines[0].amount).toBe(20);            // General cap = 20.00
  });

  it('applies the grace period of the membership type (Faculty: 3 days)', async () => {
    const lib = await librarian(); const m = await newMember({ memberTypeId: 2 }); const b = await newBook(lib);
    const l = await issue(lib, m.id, b.id); await setDue(l.id, 3);
    expect((await lib.post('/loans/return').send({ loanId: l.id })).body.data.fines).toEqual([]);
    const b2 = await newBook(lib); const l2 = await issue(lib, m.id, b2.id); await setDue(l2.id, 5);
    expect((await lib.post('/loans/return').send({ loanId: l2.id })).body.data.fines).toEqual([{ type: 'overdue', amount: 0.5 }]);
  });

  it('handles lost books (replacement cost + fee) and damaged books (default charge)', async () => {
    const lib = await librarian(); const m = await newMember();
    const lost = await newBook(lib, { acquisitionCost: 30 }); const ll = await issue(lib, m.id, lost.id);
    const r = await lib.post('/loans/return').send({ loanId: ll.id, condition: 'lost' });
    expect(r.body.data.fines).toEqual([{ type: 'lost', amount: 35 }]); expect(r.body.data.loan.status).toBe('lost');
    expect((await copiesOf(lost.id))[0].status).toBe('lost');
    expect((await lib.get(`/books/${lost.id}`)).body.data).toMatchObject({ availableCopies: 0, lostCopies: 1 });

    const m1b = await newMember(); const dmg = await newBook(lib); const dl = await issue(lib, m1b.id, dmg.id);
    const d = await lib.post('/loans/return').send({ loanId: dl.id, condition: 'damaged', damageCharge: 7.25 });
    expect(d.body.data.fines).toEqual([{ type: 'damage', amount: 7.25 }]);
    expect((await copiesOf(dmg.id))[0].status).toBe('damaged');
    const dmg2 = await newBook(lib); const dl2 = await issue(lib, (await newMember()).id, dmg2.id);
    expect((await lib.post('/loans/return').send({ loanId: dl2.id, condition: 'damaged' })).body.data.fines[0].amount).toBe(10);   // default setting
  });
});

describe('renewals', () => {
  it('renews with the policy period, records history, and enforces the limit', async () => {
    const lib = await librarian(); const m = await newMember(); const b = await newBook(lib);
    const loan = await issue(lib, m.id, b.id);
    const r1 = await m.c.post(`/loans/${loan.id}/renew`).send({});
    expect(r1.status).toBe(200); expect(r1.body.data.dueDate).toBe(addDays(loan.dueDate, 14)); expect(r1.body.data.renewalCount).toBe(1);
    expect((await lib.post(`/loans/${loan.id}/renew`).send({})).status).toBe(200);
    const r3 = await m.c.post(`/loans/${loan.id}/renew`).send({});
    expect(r3.status).toBe(422); expect(r3.body.error.message).toMatch(/limit/i);
    const det = await m.c.get(`/loans/${loan.id}`); expect(det.body.data.renewals).toHaveLength(2);
    expect(det.body.data.renewals[0].oldDueDate).toBe(loan.dueDate);
  });

  it('refuses renewal when overdue, when another member has reserved the book, for others loans, and for closed loans', async () => {
    const lib = await librarian(); const m = await newMember(); const other = await newMember();
    const b = await newBook(lib); const loan = await issue(lib, m.id, b.id);
    expect((await other.c.post(`/loans/${loan.id}/renew`).send({})).status).toBe(403);
    expect((await other.c.post('/reservations').send({ bookId: b.id })).status).toBe(201);
    const blocked = await m.c.post(`/loans/${loan.id}/renew`).send({});
    expect(blocked.status).toBe(422); expect(blocked.body.error.message).toMatch(/reserved/);

    const b2 = await newBook(lib); const l2 = await issue(lib, m.id, b2.id); await setDue(l2.id, 1);
    expect((await m.c.post(`/loans/${l2.id}/renew`).send({})).body.error.message).toMatch(/overdue/i);
    await lib.post('/loans/return').send({ loanId: l2.id });
    expect((await m.c.post(`/loans/${l2.id}/renew`).send({})).status).toBe(422);
  });
});

describe('reservations', () => {
  it('queues, holds a returned copy for the first in line, fulfils on issue, and passes it on when cancelled', async () => {
    const lib = await librarian(); const b = await newBook(lib, { copies: 1 });
    const [a, r1, r2, other] = await Promise.all([newMember(), newMember(), newMember(), newMember()]);
    expect((await r1.c.post('/reservations').send({ bookId: b.id })).status).toBe(422);           // still available -> borrow instead
    const loan = await issue(lib, a.id, b.id);
    const q1 = await r1.c.post('/reservations').send({ bookId: b.id }); const q2 = await r2.c.post('/reservations').send({ bookId: b.id });
    expect([q1.status, q2.status]).toEqual([201, 201]); expect([q1.body.data.queuePosition, q2.body.data.queuePosition]).toEqual([1, 2]);
    expect((await r1.c.post('/reservations').send({ bookId: b.id })).status).toBe(422);          // duplicate
    expect((await a.c.post('/reservations').send({ bookId: b.id })).body.error.message).toMatch(/already have/);

    await lib.post('/loans/return').send({ loanId: loan.id });
    expect((await copiesOf(b.id))[0].status).toBe('held');
    const mine = await r1.c.get('/reservations/mine'); expect(mine.body.data[0]).toMatchObject({ status: 'ready' }); expect(mine.body.data[0].expiresAt).toBeTruthy();
    expect((await queryOne<any>("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND type = 'reservation_ready'", [r1.id])).n).toBe(1);
    expect((await r2.c.get('/reservations/mine')).body.data[0]).toMatchObject({ status: 'pending', queuePosition: 1 });
    expect((await lib.post('/loans/issue').send({ memberId: other.id, bookId: b.id })).status).toBe(422);              // held for r1
    expect((await lib.post('/loans/issue').send({ memberId: r2.id, copyId: (await copiesOf(b.id))[0].id })).status).toBe(422);

    expect((await r1.c.post(`/reservations/${mine.body.data[0].id}/cancel`).send({})).status).toBe(200);
    expect((await r2.c.get('/reservations/mine')).body.data[0].status).toBe('ready');                                  // passed to the next member
    expect((await r1.c.post(`/reservations/${mine.body.data[0].id}/cancel`).send({})).status).toBe(422);
    expect((await r1.c.post(`/reservations/${(await r2.c.get('/reservations/mine')).body.data[0].id}/cancel`).send({})).status).toBe(403);

    const l2 = await issue(lib, r2.id, b.id);                                                                           // staff issues to the reserving member
    expect((await r2.c.get('/reservations/mine')).body.data[0].status).toBe('fulfilled');
    expect(l2.copyId).toBe((await copiesOf(b.id))[0].id);
  });

  it('expires uncollected holds via maintenance and releases the copy to the next in queue', async () => {
    const lib = await librarian(); const b = await newBook(lib, { copies: 1 });
    const [a, r1, r2] = await Promise.all([newMember(), newMember(), newMember()]);
    const loan = await issue(lib, a.id, b.id);
    await r1.c.post('/reservations').send({ bookId: b.id }); await r2.c.post('/reservations').send({ bookId: b.id });
    await lib.post('/loans/return').send({ loanId: loan.id });
    await exec("UPDATE reservations SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE user_id = ? AND status = 'ready'", [r1.id]);
    const out = await runMaintenance(); expect(out.reservationsExpired).toBeGreaterThanOrEqual(1);
    expect((await r1.c.get('/reservations/mine')).body.data[0].status).toBe('expired');
    expect((await r2.c.get('/reservations/mine')).body.data[0].status).toBe('ready');
    expect((await queryOne<any>("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND type = 'reservation_expired'", [r1.id])).n).toBe(1);
    await exec("UPDATE reservations SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE user_id = ? AND status = 'ready'", [r2.id]);
    await runMaintenance();
    expect((await copiesOf(b.id))[0].status).toBe('available');                                                         // queue empty -> back on the shelf
  });

  it('serialises concurrent reservations/returns without handing one copy to two members', async () => {
    const lib = await librarian(); const b = await newBook(lib, { copies: 1 });
    const a = await newMember(); const waiters = await Promise.all([newMember(), newMember(), newMember()]);
    const loan = await issue(lib, a.id, b.id);
    await Promise.all(waiters.map((w) => w.c.post('/reservations').send({ bookId: b.id })));
    await lib.post('/loans/return').send({ loanId: loan.id });
    const ready = await query<any>("SELECT * FROM reservations WHERE book_id = ? AND status = 'ready'", [b.id]);
    expect(ready).toHaveLength(1);
    expect((await copiesOf(b.id)).filter((c) => c.status === 'held')).toHaveLength(1);
  });

  it('members cannot reserve for others; unknown/archived books are rejected; limits apply', async () => {
    const lib = await librarian(); const m = await newMember(); const x = await newMember();
    const b = await newBook(lib, { copies: 1 }); await issue(lib, x.id, b.id);
    const forOther = await m.c.post('/reservations').send({ bookId: b.id, memberId: x.id });
    expect(forOther.body.data.userId).toBe(m.id);                                                                       // memberId ignored for members
    expect((await m.c.post('/reservations').send({ bookId: 999999 })).status).toBe(404);
    expect((await lib.get('/reservations?status=open')).status).toBe(200);
  });
});
void uniq;

import { describe, expect, it } from 'vitest';
import { admin, librarian, newMember } from './helpers';
import { queryOne, query } from '../src/lib/db';

async function fineFor(lib: Awaited<ReturnType<typeof librarian>>, memberId: number, amount: number, reason = 'Test fine') {
  const r = await lib.post('/fines').send({ memberId, amount, reason });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return r.body.data;
}

describe('fines and payments', () => {
  it('records a manual fine with audit fields and notifies the member', async () => {
    const lib = await librarian(); const m = await newMember();
    const f = await fineFor(lib, m.id, 5);
    expect(f).toMatchObject({ amount: 5, outstanding: 5, status: 'outstanding', fineType: 'manual', createdBy: 'Liam Librarian' });
    expect((await queryOne<any>("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND type = 'fine_created'", [m.id])).n).toBe(1);
    expect((await lib.post('/fines').send({ memberId: m.id, amount: 0, reason: 'x' })).status).toBe(400);
    expect((await lib.post('/fines').send({ memberId: m.id, amount: 3, reason: '' })).status).toBe(400);
    expect((await m.c.post('/fines').send({ memberId: m.id, amount: 3, reason: 'sneaky' })).status).toBe(403);
  });

  it('applies partial then full payments, tracks balances, and issues receipts', async () => {
    const lib = await librarian(); const m = await newMember(); const f = await fineFor(lib, m.id, 5);
    const p1 = await lib.post('/payments').send({ memberId: m.id, amount: 3, method: 'cash', reference: 'DESK-001' });
    expect(p1.status).toBe(201); expect(p1.body.data.receiptNumber).toMatch(/^RCPT-\d{8}-\d{6}$/); expect(p1.body.data.remainingBalance).toBe(2);
    expect(await queryOne('SELECT 1 FROM fines WHERE id = ? AND status = \'partial\' AND paid_amount = 3', [f.id])).toBeTruthy();
    expect((await lib.post('/payments').send({ memberId: m.id, amount: 2.5 })).status).toBe(422);          // exceeds outstanding
    const p2 = await lib.post('/payments').send({ memberId: m.id, amount: 2, method: 'card', reference: 'TERM-77' });
    expect(p2.body.data.remainingBalance).toBe(0);
    expect(await queryOne('SELECT 1 FROM fines WHERE id = ? AND status = \'paid\' AND paid_amount = 5', [f.id])).toBeTruthy();
    expect((await lib.post('/payments').send({ memberId: m.id, amount: 1 })).status).toBe(422);              // nothing left to pay
    const alloc = await query<any>('SELECT SUM(amount) s FROM payment_allocations WHERE fine_id = ?', [f.id]); expect(Number(alloc[0].s)).toBe(5);

    const mine = await m.c.get('/payments/mine'); expect(mine.body.meta.total).toBe(2);
    const receipt = await m.c.get(`/payments/${p1.body.data.id}`);
    expect(receipt.body.data).toMatchObject({ receiptNumber: p1.body.data.receiptNumber, amount: 3, method: 'cash' });
    expect(receipt.body.data.allocations).toHaveLength(1); expect(receipt.body.data.library.name).toBeTruthy();
    const mf = await m.c.get('/fines/mine'); expect(mf.body.meta.outstanding).toBe(0); expect(mf.body.data[0].status).toBe('paid');
  });

  it('allocates one payment across several fines oldest-first, or only the chosen fines', async () => {
    const lib = await librarian(); const m = await newMember();
    const a = await fineFor(lib, m.id, 4); const b = await fineFor(lib, m.id, 4); const c = await fineFor(lib, m.id, 4);
    const p = await lib.post('/payments').send({ memberId: m.id, amount: 6 });
    expect(p.status).toBe(201);
    const rows = await query<any>('SELECT id, paid_amount, status FROM fines WHERE user_id = ? ORDER BY id', [m.id]);
    expect(rows.map((r) => [r.id, r.paid_amount, r.status])).toEqual([[a.id, 4, 'paid'], [b.id, 2, 'partial'], [c.id, 0, 'outstanding']]);
    const sel = await lib.post('/payments').send({ memberId: m.id, amount: 4, fineIds: [c.id] });
    expect(sel.status).toBe(201);
    expect((await queryOne<any>('SELECT status FROM fines WHERE id = ?', [c.id])).status).toBe('paid');
    expect((await lib.post('/payments').send({ memberId: m.id, amount: 1, fineIds: [a.id] })).status).toBe(422);   // already paid
  });

  it('keeps balances correct under concurrent payments', async () => {
    const lib = await librarian(); const m = await newMember(); const f = await fineFor(lib, m.id, 5);
    const rs = await Promise.all([1, 2, 3, 4].map(() => lib.post('/payments').send({ memberId: m.id, amount: 3 })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    const row = await queryOne<any>('SELECT paid_amount, status FROM fines WHERE id = ?', [f.id]);
    expect(row).toMatchObject({ paid_amount: 3, status: 'partial' });
    const paid = await queryOne<any>("SELECT SUM(amount) s FROM payments WHERE user_id = ? AND kind = 'payment'", [m.id]); expect(Number(paid.s)).toBe(3);
  });

  it('waives fines (needs a reason), supports partial waivers and keeps the audit trail', async () => {
    const lib = await librarian(); const m = await newMember(); const f = await fineFor(lib, m.id, 10);
    expect((await lib.post(`/fines/${f.id}/waive`).send({ amount: 2 })).status).toBe(400);
    const w1 = await lib.post(`/fines/${f.id}/waive`).send({ amount: 4, reason: 'Hardship' });
    expect(w1.body.data).toMatchObject({ waivedAmount: 4, outstanding: 6, status: 'partial', waiverReason: 'Hardship', waivedBy: 'Liam Librarian' });
    expect((await lib.post(`/fines/${f.id}/waive`).send({ amount: 7, reason: 'too much' })).status).toBe(422);
    await lib.post('/payments').send({ memberId: m.id, amount: 2 });
    const w2 = await lib.post(`/fines/${f.id}/waive`).send({ reason: 'Goodwill' });
    expect(w2.body.data).toMatchObject({ outstanding: 0, status: 'paid', waivedAmount: 8, paidAmount: 2 });
    expect((await lib.post(`/fines/${f.id}/waive`).send({ reason: 'again' })).status).toBe(422);
    const m2 = await newMember(); const f2 = await fineFor(lib, m2.id, 3);
    expect((await lib.post(`/fines/${f2.id}/waive`).send({ reason: 'Full waiver' })).body.data.status).toBe('waived');
    expect((await queryOne<any>("SELECT COUNT(*) n FROM audit_logs WHERE action = 'fine.waive' AND entity_id = ?", [String(f.id)])).n).toBe(2);
    expect((await m.c.post(`/fines/${f.id}/waive`).send({ reason: 'self-service' })).status).toBe(403);
  });

  it('reverses payments (admin only) without deleting records, restoring the balance once', async () => {
    const lib = await librarian(); const a = await admin(); const m = await newMember(); const f = await fineFor(lib, m.id, 6);
    const p = await lib.post('/payments').send({ memberId: m.id, amount: 6 });
    expect((await lib.post(`/payments/${p.body.data.id}/refund`).send({ reason: 'mistake' })).status).toBe(403);
    expect((await a.post(`/payments/${p.body.data.id}/refund`).send({})).status).toBe(400);
    const rf = await a.post(`/payments/${p.body.data.id}/refund`).send({ reason: 'Paid in error' });
    expect(rf.status).toBe(201); expect(rf.body.data).toMatchObject({ kind: 'refund', amount: 6, reversesPaymentId: p.body.data.id });
    expect(await queryOne("SELECT 1 FROM fines WHERE id = ? AND status = 'outstanding' AND paid_amount = 0", [f.id])).toBeTruthy();
    expect((await a.post(`/payments/${p.body.data.id}/refund`).send({ reason: 'twice' })).status).toBe(422);
    expect((await a.post(`/payments/${rf.body.data.id}/refund`).send({ reason: 'refund of refund' })).status).toBe(422);
    expect((await query('SELECT id FROM payments WHERE user_id = ?', [m.id]))).toHaveLength(2);         // original + reversal both retained
  });

  it('rejects anything that looks like a card number, and members cannot record payments', async () => {
    const lib = await librarian(); const m = await newMember(); await fineFor(lib, m.id, 5);
    expect((await lib.post('/payments').send({ memberId: m.id, amount: 1, reference: '4111 1111 1111 1111' })).status).toBe(400);
    expect((await lib.post('/payments').send({ memberId: m.id, amount: 1, notes: 'card 4111111111111111' })).status).toBe(400);
    expect((await m.c.post('/payments').send({ memberId: m.id, amount: 1 })).status).toBe(403);
    expect((await lib.post('/payments').send({ memberId: m.id, amount: -1 })).status).toBe(400);
  });

  it('members only see their own fines, payments and receipts', async () => {
    const lib = await librarian(); const a = await newMember(); const b = await newMember();
    await fineFor(lib, a.id, 2); const p = await lib.post('/payments').send({ memberId: a.id, amount: 2 });
    expect((await b.c.get(`/payments/${p.body.data.id}`)).status).toBe(403);
    expect((await b.c.get('/fines/mine')).body.data).toEqual([]);
    expect((await b.c.get('/fines')).status).toBe(403); expect((await b.c.get('/payments')).status).toBe(403);
    expect((await b.c.get(`/fines/balance/${a.id}`)).status).toBe(403);
  });
});

import { randomUUID } from 'node:crypto';
import { stageEvent } from '@hms/shared/kafka';
import { BadRequestError, ConflictError, NotFoundError, dateOnly, hasRole, isAdmin, pageOf, parseDate, toNum, todayStr } from '@hms/shared/utils';

const r2 = (n) => Math.round(n * 100) / 100;
const toBill = (b) => ({
  id: b.id, billNumber: b.billNumber, patientId: b.patientId, patientName: b.patientName, billType: b.billType, referenceType: b.referenceType, referenceId: b.referenceId, status: b.status,
  totalAmount: toNum(b.totalAmount), paidAmount: toNum(b.paidAmount), currency: b.currency, dueDate: dateOnly(b.dueDate), note: b.note, createdAt: b.createdAt,
  items: (b.items ?? []).map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: toNum(i.unitPrice), amount: toNum(i.amount) })),
});
const toPayment = (p, billNumber) => ({ id: p.id, billId: p.billId, billNumber: billNumber ?? p.bill?.billNumber, transactionRef: p.transactionRef, amount: toNum(p.amount), method: p.method, status: p.status, failureReason: p.failureReason, initiatedAt: p.initiatedAt, completedAt: p.completedAt });

/** Stand-in for a real payment gateway (none configured): it never sees card data and only decides the outcome. */
const simulateGateway = (forced) => (forced === 'SUCCESS' ? 'SUCCESS' : forced === 'FAILURE' ? 'FAILED' : null);

export function createBillingService({ prisma, logger, config, patients, appointments }) {
  const findBill = async (id, db = prisma) => (await db.bill.findUnique({ where: { id }, include: { items: true } })) ?? (() => { throw new NotFoundError(`Bill ${id} not found`); })();
  const guard = async (bill, user) => { if (hasRole(user, 'PATIENT') && !isAdmin(user)) await patients.requireAccess(bill.patientId, user); };
  const dueDate = () => { const d = new Date(); d.setDate(d.getDate() + config.jobs.billDueDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /** Creates the bill + items and stages BillingGenerated in the given transaction. */
  async function persistBill(tx, { patientId, patientName, patientEmail, billType, referenceType, referenceId, note, items }) {
    const total = r2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
    const due = dueDate();
    const created = await tx.bill.create({ data: { billNumber: `TMP-${randomUUID()}`, patientId, patientName, patientEmail, billType, referenceType, referenceId, note, totalAmount: total, dueDate: parseDate(due),
      items: { create: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: r2(i.unitPrice * i.quantity) })) } } });
    const d = new Date();
    const billNumber = `BILL-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(created.id).padStart(6, '0')}`;
    const bill = await tx.bill.update({ where: { id: created.id }, data: { billNumber }, include: { items: true } });
    await stageEvent(tx, 'BillingGenerated', bill.id, { billId: bill.id, billNumber, patientId, patientName, patientEmail, billType, referenceType, referenceId, amount: total, dueDate: due });
    logger.info({ billNumber, amount: total, patientId }, 'Bill generated');
    return bill;
  }

  /** Manual bill by billing staff; an APPOINTMENT bill is verified against the Appointment Service over HTTP (fetch + Opossum). */
  async function createManual(b) {
    const patient = await patients.get(b.patientId);                      // gRPC
    const refType = b.billType !== 'OTHER' && b.referenceId ? b.billType : null;
    if (b.billType === 'APPOINTMENT') {
      if (!b.referenceId) throw new BadRequestError('referenceId (appointment id) is required for APPOINTMENT bills');
      const appt = await appointments.get(b.referenceId);                 // HTTP
      if (appt.patientId !== patient.id) throw new BadRequestError(`Appointment ${appt.id} does not belong to patient ${patient.id}`);
      if (appt.status === 'CANCELLED') throw new BadRequestError(`Appointment ${appt.id} is cancelled`);
    }
    if (refType && await prisma.bill.findFirst({ where: { referenceType: refType, referenceId: b.referenceId } })) throw new ConflictError(`A ${refType} bill already exists for reference ${b.referenceId}`);
    try {
      return toBill(await prisma.$transaction((tx) => persistBill(tx, { patientId: patient.id, patientName: patient.fullName, patientEmail: patient.email, billType: b.billType, referenceType: refType, referenceId: refType ? b.referenceId : null, note: b.note ?? null, items: b.items })));
    } catch (e) { if (e.code === 'P2002') throw new ConflictError('A bill already exists for this reference'); throw e; }
  }

  // ---- called by Kafka consumers (inside the consumer's transaction)
  async function generateFromEvent(tx, { billType, referenceType, referenceId, patientId, patientName, patientEmail, description, unitPrice, quantity = 1, note }) {
    if (!unitPrice || unitPrice <= 0) { logger.info({ referenceType, referenceId }, 'No billable amount - bill not created'); return; }
    if (await tx.bill.findFirst({ where: { referenceType, referenceId } })) { logger.info({ referenceType, referenceId }, 'Bill already exists - skipping'); return; }
    await persistBill(tx, { patientId, patientName, patientEmail, billType, referenceType, referenceId, note: note ?? `Auto-generated from ${referenceType} #${referenceId}`, items: [{ description, quantity, unitPrice }] });
  }
  async function generateMedicineBill(tx, e) {
    if (!e.totalAmount || await tx.bill.findFirst({ where: { referenceType: 'PHARMACY_ORDER', referenceId: e.orderId } })) return;
    await persistBill(tx, { patientId: e.patientId, patientName: e.patientName, patientEmail: e.patientEmail, billType: 'MEDICINE', referenceType: 'PHARMACY_ORDER', referenceId: e.orderId,
      note: `Medicines dispensed for prescription #${e.prescriptionId}`, items: e.items.map((i) => ({ description: i.medicineName, quantity: i.quantity, unitPrice: i.unitPrice })) });
  }
  /** Compensating action: an unpaid appointment bill is cancelled when its appointment is cancelled. */
  async function onAppointmentCancelled(tx, appointmentId) {
    const b = await tx.bill.findFirst({ where: { referenceType: 'APPOINTMENT', referenceId: appointmentId } });
    if (!b) return;
    if (['PENDING', 'OVERDUE'].includes(b.status)) { await tx.bill.update({ where: { id: b.id }, data: { status: 'CANCELLED', note: `Cancelled because appointment ${appointmentId} was cancelled` } }); logger.info({ billNumber: b.billNumber }, 'Bill cancelled (appointment cancelled)'); }
    else if (b.status === 'PAID') { await tx.bill.update({ where: { id: b.id }, data: { note: `Appointment ${appointmentId} was cancelled after payment - REFUND REQUIRED` } }); logger.warn({ billNumber: b.billNumber }, 'Paid bill of a cancelled appointment: manual refund required'); }
  }

  // ---- payments (Scenario 6)
  async function initiatePayment(billId, b, user) {
    const bill = await findBill(billId);
    await guard(bill, user);
    if (bill.status === 'PAID') throw new ConflictError(`Bill ${bill.billNumber} is already paid`);
    if (bill.status === 'CANCELLED') throw new ConflictError(`Bill ${bill.billNumber} is cancelled`);
    let p;
    try {
      p = await prisma.payment.create({ data: { billId, method: b.method, amount: r2(toNum(bill.totalAmount) - toNum(bill.paidAmount)), activeBillId: billId, transactionRef: `TXN-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}` } });
    } catch (e) { if (e.code === 'P2002') throw new ConflictError('A payment for this bill is already in progress'); throw e; }   // unique activeBillId
    logger.info({ ref: p.transactionRef, billNumber: bill.billNumber, method: p.method }, 'Payment initiated');
    const outcome = simulateGateway(b.simulateOutcome);
    if (outcome) p = await settle(p.id, outcome, outcome === 'FAILED' ? 'Declined by simulated gateway' : null);
    return toPayment(p, bill.billNumber);
  }
  async function updatePaymentStatus(ref, { status, failureReason }) {
    const p = await prisma.payment.findUnique({ where: { transactionRef: ref } });
    if (!p) throw new NotFoundError(`Payment ${ref} not found`);
    if (p.status !== 'PENDING') throw new ConflictError(`Payment ${ref} is already ${p.status}`);
    return toPayment(await settle(p.id, status, failureReason));
  }
  /** Settles a PENDING payment, updates the bill and stages PaymentCompleted / PaymentFailed - one transaction. */
  async function settle(paymentId, outcome, reason) {
    return prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { bill: true } });
      if (p.status !== 'PENDING') return p;
      const b = p.bill;
      const base = { billId: b.id, billNumber: b.billNumber, transactionRef: p.transactionRef, patientId: b.patientId, patientName: b.patientName, patientEmail: b.patientEmail, referenceType: b.referenceType, referenceId: b.referenceId, amount: toNum(p.amount) };
      if (outcome === 'SUCCESS') {
        const paid = r2(toNum(b.paidAmount) + toNum(p.amount));
        await tx.bill.update({ where: { id: b.id }, data: { paidAmount: paid, ...(paid >= toNum(b.totalAmount) ? { status: 'PAID' } : {}) } });
        await stageEvent(tx, 'PaymentCompleted', b.id, base);
      } else {
        await stageEvent(tx, 'PaymentFailed', b.id, { ...base, reason: reason ?? 'Payment failed' });
      }
      const upd = await tx.payment.update({ where: { id: p.id }, data: { status: outcome, activeBillId: null, completedAt: new Date(), failureReason: outcome === 'FAILED' ? reason ?? 'Payment failed' : null }, include: { bill: true } });
      logger.info({ ref: p.transactionRef, outcome, billNumber: b.billNumber }, 'Payment settled');
      return upd;
    });
  }
  async function cancel(billId) {
    const bill = await findBill(billId);
    if (bill.status === 'PAID') throw new ConflictError('A paid bill cannot be cancelled');
    if (await prisma.payment.findFirst({ where: { billId, status: 'PENDING' } })) throw new ConflictError('A payment is in progress for this bill');
    return toBill(await prisma.bill.update({ where: { id: billId }, data: { status: 'CANCELLED' }, include: { items: true } }));
  }

  // ---- reads
  async function get(id, user) { const b = await findBill(id); await guard(b, user); return toBill(b); }
  async function forPatient(patientId, user) {
    await patients.requireAccess(patientId, user);
    return (await prisma.bill.findMany({ where: { patientId }, include: { items: true }, orderBy: { createdAt: 'desc' } })).map(toBill);
  }
  async function list({ status, page, size }) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([prisma.bill.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: page * size, take: size }), prisma.bill.count({ where })]);
    return pageOf(rows.map(toBill), page, size, total);
  }
  async function paymentsOf(billId, user) {
    const b = await findBill(billId); await guard(b, user);
    return (await prisma.payment.findMany({ where: { billId }, orderBy: { initiatedAt: 'desc' } })).map((p) => toPayment(p, b.billNumber));
  }
  async function payment(ref, user) {
    const p = await prisma.payment.findUnique({ where: { transactionRef: ref }, include: { bill: true } });
    if (!p) throw new NotFoundError(`Payment ${ref} not found`);
    await guard(p.bill, user);
    return toPayment(p);
  }

  // ---- scheduled jobs
  async function failStalePayments() {
    const stale = await prisma.payment.findMany({ where: { status: 'PENDING', initiatedAt: { lt: new Date(Date.now() - config.jobs.paymentTimeoutMinutes * 60000) } } });
    for (const p of stale) await settle(p.id, 'FAILED', 'Timed out waiting for payment confirmation');
    if (stale.length) logger.info({ count: stale.length }, 'Pending-payment job: payment(s) timed out');
  }
  async function overdueAndReminders() {
    const overdue = await prisma.bill.updateMany({ where: { status: 'PENDING', dueDate: { lt: parseDate(todayStr()) } }, data: { status: 'OVERDUE' } });
    if (overdue.count) logger.info({ count: overdue.count }, 'Bills marked OVERDUE');
    const interval = config.jobs.billReminderHours * 3600000;
    const now = Date.now();
    const bills = await prisma.bill.findMany({ where: { status: { in: ['PENDING', 'OVERDUE'] }, createdAt: { lt: new Date(now - interval) }, OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(now - interval) } }] } });
    let n = 0;
    for (const b of bills.filter((x) => x.patientEmail)) {
      await prisma.$transaction(async (tx) => {
        await stageEvent(tx, 'NotificationRequested', `bill-reminder-${b.id}`, { recipientEmail: b.patientEmail, channel: 'EMAIL', subject: `Payment reminder: ${b.billNumber}`,
          message: `Your bill ${b.billNumber} of ${r2(toNum(b.totalAmount) - toNum(b.paidAmount))} ${b.currency} is ${b.status.toLowerCase()} (due ${dateOnly(b.dueDate)}). Please complete the payment.`, eventType: 'PAYMENT_REMINDER', referenceId: String(b.id) });
        await tx.bill.update({ where: { id: b.id }, data: { lastReminderAt: new Date() } });
      });
      n += 1;
    }
    if (n) logger.info({ count: n }, 'Billing reminder job: reminder(s) queued');
  }
  return { createManual, generateFromEvent, generateMedicineBill, onAppointmentCancelled, initiatePayment, updatePaymentStatus, cancel, get, forPatient, list, paymentsOf, payment, failStalePayments, overdueAndReminders };
}

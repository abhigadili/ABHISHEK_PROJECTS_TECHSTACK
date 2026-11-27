import { Prisma } from '../generated/client/index.js';
import { stageEvent } from '@hms/shared/kafka';
import { ConflictError, NotFoundError, pageOf, toNum } from '@hms/shared/utils';

const r2 = (n) => Math.round(n * 100) / 100;
const toMedicine = (m) => ({ id: m.id, sku: m.sku, name: m.name, genericName: m.genericName, unitPrice: toNum(m.unitPrice), stockQuantity: m.stockQuantity, reorderLevel: m.reorderLevel, active: m.active });
const toOrder = (o) => ({
  id: o.id, prescriptionId: o.prescriptionId, patientId: o.patientId, patientName: o.patientName, doctorName: o.doctorName, status: o.status, totalAmount: toNum(o.totalAmount), dispensedBy: o.dispensedBy,
  dispensedAt: o.dispensedAt, rejectionReason: o.rejectionReason, createdAt: o.createdAt,
  items: (o.items ?? []).map((i) => ({ medicineName: i.medicineName, dosage: i.dosage, quantity: i.quantity, medicineId: i.medicineId, unitPrice: toNum(i.unitPrice), inStock: Boolean(i.medicine && i.medicine.stockQuantity >= i.quantity) })),
});
const include = { items: { include: { medicine: true } } };

export function createPharmacyService({ prisma, logger, config, prescriptions }) {
  const findMatch = async (db, name) => {
    const n = name.trim();
    const rows = await db.medicine.findMany({ where: { active: true, OR: [{ name: { equals: n } }, { genericName: { equals: n } }] }, orderBy: { stockQuantity: 'desc' }, take: 1 });
    return rows[0] ?? null;
  };
  const findOrder = async (where) => (await prisma.pharmacyOrder.findFirst({ where, include })) ?? (() => { throw new NotFoundError('Pharmacy order not found'); })();

  // ---- inventory
  async function addMedicine(b) {
    if (await prisma.medicine.findUnique({ where: { sku: b.sku } })) throw new ConflictError(`SKU '${b.sku}' already exists`);
    return toMedicine(await prisma.medicine.create({ data: { ...b, genericName: b.genericName ?? null, reorderLevel: b.reorderLevel ?? 20 } }));
  }
  async function updateMedicine(id, b) {
    const m = await prisma.medicine.findUnique({ where: { id } });
    if (!m) throw new NotFoundError(`Medicine ${id} not found`);
    if (m.sku !== b.sku && await prisma.medicine.findUnique({ where: { sku: b.sku } })) throw new ConflictError(`SKU '${b.sku}' already exists`);
    return toMedicine(await prisma.medicine.update({ where: { id }, data: { ...b, genericName: b.genericName ?? null, reorderLevel: b.reorderLevel ?? m.reorderLevel } }));
  }
  async function restock(id, qty) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM hjs_medicines WHERE id = ${id} FOR UPDATE`;
      const m = await tx.medicine.findUnique({ where: { id } });
      if (!m) throw new NotFoundError(`Medicine ${id} not found`);
      const stock = m.stockQuantity + qty;
      return toMedicine(await tx.medicine.update({ where: { id }, data: { stockQuantity: stock, ...(stock > m.reorderLevel ? { lastLowStockAlertAt: null } : {}) } }));
    });
  }
  const listMedicines = async () => (await prisma.medicine.findMany({ where: { active: true }, orderBy: { name: 'asc' } })).map(toMedicine);

  /** Consumer of PrescriptionCreated: opens a PENDING order, pre-matching every line to inventory (runs inside the consumer's transaction). */
  async function openOrder(tx, e) {
    if (await tx.pharmacyOrder.findUnique({ where: { prescriptionId: e.prescriptionId } })) { logger.info({ prescriptionId: e.prescriptionId }, 'Pharmacy order already exists'); return; }
    const items = [];
    for (const i of e.items) {
      const m = await findMatch(tx, i.medicineName);
      items.push({ medicineName: i.medicineName, dosage: i.dosage, quantity: i.quantity, medicineId: m?.id ?? null, unitPrice: m?.unitPrice ?? null });
    }
    const o = await tx.pharmacyOrder.create({ data: { prescriptionId: e.prescriptionId, patientId: e.patientId, patientName: e.patientName, patientEmail: e.patientEmail, doctorName: e.doctorName, items: { create: items } } });
    logger.info({ orderId: o.id, prescriptionId: e.prescriptionId, lines: items.length }, 'Pharmacy order opened');
  }

  // ---- dispensing
  async function dispense(orderId, user) {
    const order = await prisma.pharmacyOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError(`Pharmacy order ${orderId} not found`);
    if (order.status !== 'PENDING') throw new ConflictError(`Order ${orderId} is already ${order.status}`);
    const rx = await prescriptions.status(order.prescriptionId);                       // HTTP + Opossum
    if (rx.status !== 'ACTIVE') throw new ConflictError(`Prescription ${order.prescriptionId} is ${rx.status} and cannot be dispensed`);

    await prisma.$transaction(async (tx) => {
      const o = await tx.pharmacyOrder.findUnique({ where: { id: orderId }, include: { items: true } });
      if (o.status !== 'PENDING') throw new ConflictError(`Order ${orderId} is already ${o.status}`);
      const problems = [];
      for (const i of o.items) {
        if (!i.medicineId) { const m = await findMatch(tx, i.medicineName); if (m) { i.medicineId = m.id; i.unitPrice = m.unitPrice; } }
        if (!i.medicineId) problems.push(`${i.medicineName}: not in inventory`);
      }
      // lock the stock rows (SELECT ... FOR UPDATE, in id order: no deadlocks) and verify EVERYTHING before changing anything
      const ids = [...new Set(o.items.filter((i) => i.medicineId).map((i) => i.medicineId))].sort((a, b) => a - b);
      if (ids.length) await tx.$queryRaw`SELECT id FROM hjs_medicines WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const meds = new Map((await tx.medicine.findMany({ where: { id: { in: ids } } })).map((m) => [m.id, m]));
      for (const i of o.items.filter((x) => x.medicineId)) {
        const need = o.items.filter((x) => x.medicineId === i.medicineId).reduce((s, x) => s + x.quantity, 0);
        if (meds.get(i.medicineId).stockQuantity < need) problems.push(`${i.medicineName}: need ${need}, only ${meds.get(i.medicineId).stockQuantity} in stock`);
      }
      if (problems.length) throw new ConflictError(`Cannot dispense - ${[...new Set(problems)].join('; ')}`);

      let total = 0; const sold = [];
      for (const i of o.items) {
        const m = meds.get(i.medicineId);
        await tx.medicine.update({ where: { id: m.id }, data: { stockQuantity: { decrement: i.quantity } } });
        await tx.pharmacyOrderItem.update({ where: { id: i.id }, data: { medicineId: m.id, unitPrice: m.unitPrice } });
        total += toNum(m.unitPrice) * i.quantity;
        sold.push({ medicineName: i.medicineName, quantity: i.quantity, unitPrice: toNum(m.unitPrice) });
      }
      total = r2(total);
      await tx.pharmacyOrder.update({ where: { id: orderId }, data: { status: 'DISPENSED', totalAmount: total, dispensedBy: user?.username ?? null, dispensedAt: new Date() } });
      await stageEvent(tx, 'MedicineDispensed', orderId, { orderId, prescriptionId: o.prescriptionId, patientId: o.patientId, patientName: o.patientName, patientEmail: o.patientEmail, totalAmount: total, items: sold });
      logger.info({ orderId, by: user?.username, total }, 'Order dispensed');
    }, { timeout: 20000 });
    return toOrder(await findOrder({ id: orderId }));
  }
  async function reject(orderId, reason) {
    const o = await prisma.pharmacyOrder.findUnique({ where: { id: orderId } });
    if (!o) throw new NotFoundError(`Pharmacy order ${orderId} not found`);
    if (o.status !== 'PENDING') throw new ConflictError(`Order ${orderId} is already ${o.status}`);
    await prisma.pharmacyOrder.update({ where: { id: orderId }, data: { status: 'REJECTED', rejectionReason: reason } });
    return toOrder(await findOrder({ id: orderId }));
  }
  const order = async (id) => toOrder(await findOrder({ id }));
  const orderByPrescription = async (prescriptionId) => toOrder(await findOrder({ prescriptionId }));
  async function orders({ status, page, size }) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([prisma.pharmacyOrder.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: page * size, take: size }), prisma.pharmacyOrder.count({ where })]);
    return pageOf(rows.map(toOrder), page, size, total);
  }

  // ---- scheduled job + seed
  async function lowStockAlerts() {
    const before = new Date(Date.now() - config.jobs.lowStockAlertHours * 3600000);
    const low = (await prisma.medicine.findMany({ where: { active: true, OR: [{ lastLowStockAlertAt: null }, { lastLowStockAlertAt: { lt: before } }] } })).filter((m) => m.stockQuantity <= m.reorderLevel);
    for (const m of low) {
      await prisma.$transaction(async (tx) => {
        await stageEvent(tx, 'NotificationRequested', `low-stock-${m.id}`, { recipientEmail: config.jobs.pharmacyAlertEmail, channel: 'EMAIL', subject: `Low stock: ${m.name}`,
          message: `${m.name} (${m.sku}) has only ${m.stockQuantity} unit(s) left (reorder level ${m.reorderLevel}).`, eventType: 'LOW_STOCK', referenceId: String(m.id) });
        await tx.medicine.update({ where: { id: m.id }, data: { lastLowStockAlertAt: new Date() } });
      });
    }
    if (low.length) logger.info({ count: low.length }, 'Low-stock job: alert(s) queued');
  }
  async function seed() {
    if (await prisma.medicine.count()) return;
    await prisma.medicine.createMany({ data: [
      { sku: 'MED-PARA500', name: 'Paracetamol 500mg', genericName: 'Paracetamol', unitPrice: 2.5, stockQuantity: 500 }, { sku: 'MED-AMOX500', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', unitPrice: 8, stockQuantity: 300 },
      { sku: 'MED-IBU400', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', unitPrice: 4, stockQuantity: 400 }, { sku: 'MED-METF500', name: 'Metformin 500mg', genericName: 'Metformin', unitPrice: 3.5, stockQuantity: 350 },
      { sku: 'MED-ATOR10', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin', unitPrice: 6, stockQuantity: 250 }, { sku: 'MED-CETI10', name: 'Cetirizine 10mg', genericName: 'Cetirizine', unitPrice: 1.5, stockQuantity: 600 } ] });
    logger.info('Seeded 6 medicines');
  }
  return { addMedicine, updateMedicine, restock, listMedicines, openOrder, dispense, reject, order, orderByPrescription, orders, lowStockAlerts, seed };
}

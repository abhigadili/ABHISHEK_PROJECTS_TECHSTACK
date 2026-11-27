import "server-only";
import { db } from "@/server/db";
import { assertCan } from "@/server/authorization/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/server/utilities/errors";
import { medicineSchema, stockSchema, adjustSchema, dispenseSchema } from "@/lib/validations/clinical";
import { addCharges } from "./billing.service";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import { rxInclude } from "./prescription.service";
import type { Principal } from "@/server/authorization/principal";
import type { Prisma } from "@prisma/client";

const hid = (p: Principal) => {
    if (!p.hospitalId && p.role !== "SUPER_ADMIN") throw forbidden("Your account is not linked to a hospital");
    return p.hospitalId;
};

export const pharmacyService = {
    categories: () => db.medicineCategory.findMany({ orderBy: { name: "asc" } }),
    async medicines(p: Principal, q: { q?: string; categoryId?: number; page: number; size: number }) {
        await assertCan(p, "pharmacy:read");
        const where: Prisma.MedicineWhereInput = {
            active: true,
            ...(q.categoryId ? { categoryId: q.categoryId } : {}),
            ...(q.q
                ? { OR: [{ name: { contains: q.q } }, { genericName: { contains: q.q } }, { sku: { contains: q.q } }] }
                : {}),
        };
        const [rows, total] = await Promise.all([
            db.medicine.findMany({
                where,
                include: {
                    category: true,
                    inventory: {
                        where: {
                            ...(p.hospitalId ? { hospitalId: p.hospitalId } : {}),
                            quantity: { gt: 0 },
                            expiryDate: { gt: new Date() },
                        },
                        select: { quantity: true },
                    },
                },
                orderBy: { name: "asc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.medicine.count({ where }),
        ]);
        return {
            items: rows.map(({ inventory, ...m }) => ({ ...m, stock: inventory.reduce((s, i) => s + i.quantity, 0) })),
            total,
        };
    },
    async createMedicine(p: Principal, raw: unknown) {
        await assertCan(p, "pharmacy:manage");
        const d = medicineSchema.parse(raw);
        try {
            const m = await db.medicine.create({ data: { ...d, genericName: d.genericName || null } });
            await audit(p, "MEDICINE_CREATED", "Medicine", m.id);
            return m;
        } catch {
            throw conflict("SKU already exists", { sku: "Already exists" });
        }
    },
    async inventory(p: Principal, q: { filter?: "expiring" | "low" | "all"; page: number; size: number }) {
        await assertCan(p, "pharmacy:read");
        const h = hid(p);
        const soon = new Date(Date.now() + 90 * 86400_000);
        const where: Prisma.PharmacyInventoryWhereInput = {
            ...(h ? { hospitalId: h } : {}),
            ...(q.filter === "expiring" ? { expiryDate: { lt: soon }, quantity: { gt: 0 } } : {}),
        };
        const [items, total] = await Promise.all([
            db.pharmacyInventory.findMany({
                where,
                include: { medicine: { select: { name: true, sku: true, reorderLevel: true } } },
                orderBy: { expiryDate: "asc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.pharmacyInventory.count({ where }),
        ]);
        return { items, total };
    },
    /** Low-stock: total NON-expired quantity per medicine at this hospital is below its reorder level. */
    async lowStock(p: Principal) {
        await assertCan(p, "pharmacy:read");
        const h = hid(p);
        const meds = await db.medicine.findMany({
            where: { active: true },
            include: {
                inventory: {
                    where: { ...(h ? { hospitalId: h } : {}), expiryDate: { gt: new Date() } },
                    select: { quantity: true },
                },
            },
        });
        return meds
            .map((m) => ({
                id: m.id,
                name: m.name,
                sku: m.sku,
                reorderLevel: m.reorderLevel,
                stock: m.inventory.reduce((s, i) => s + i.quantity, 0),
            }))
            .filter((m) => m.stock <= m.reorderLevel)
            .sort((a, b) => a.stock - b.stock);
    },
    async receiveStock(p: Principal, raw: unknown) {
        await assertCan(p, "pharmacy:manage");
        const h = hid(p);
        if (!h) throw badRequest("Select a hospital account");
        const d = stockSchema.parse(raw);
        const row = await db.pharmacyInventory.upsert({
            where: {
                medicineId_hospitalId_batchNumber: {
                    medicineId: d.medicineId,
                    hospitalId: h,
                    batchNumber: d.batchNumber,
                },
            },
            create: {
                medicineId: d.medicineId,
                hospitalId: h,
                batchNumber: d.batchNumber,
                expiryDate: new Date(d.expiryDate),
                quantity: d.quantity,
            },
            update: { quantity: { increment: d.quantity }, expiryDate: new Date(d.expiryDate) },
        });
        await audit(p, "STOCK_RECEIVED", "PharmacyInventory", row.id, { qty: d.quantity });
        return row;
    },
    async adjustStock(p: Principal, inventoryId: number, raw: unknown) {
        await assertCan(p, "pharmacy:manage");
        const d = adjustSchema.parse(raw);
        const inv = await db.pharmacyInventory.findUnique({ where: { id: inventoryId } });
        if (!inv) throw notFound("Batch");
        if (p.hospitalId && inv.hospitalId !== p.hospitalId) throw forbidden();
        if (inv.quantity + d.delta < 0) throw badRequest("Stock cannot go below zero", { delta: "Too low" });
        await db.pharmacyInventory.update({ where: { id: inventoryId }, data: { quantity: { increment: d.delta } } });
        await audit(p, "STOCK_ADJUSTED", "PharmacyInventory", inventoryId, { delta: d.delta, reason: d.reason });
    },
    /** Prescription queue: ACTIVE / PARTIALLY_DISPENSED, not expired. */
    async queue(p: Principal) {
        await assertCan(p, "pharmacy:read");
        return db.prescription.findMany({
            where: { status: { in: ["ACTIVE", "PARTIALLY_DISPENSED"] }, validUntil: { gte: new Date() } },
            include: rxInclude,
            orderBy: { createdAt: "asc" },
            take: 50,
        });
    },
    /**
     * Scenario 5 steps 10-12: dispense in ONE transaction - first-expiry-first-out batches, never expired or insufficient stock,
     * item/prescription status, dispensing history and medicine charges on the patient's invoice.
     */
    async dispense(p: Principal, prescriptionId: number, raw: unknown) {
        await assertCan(p, "pharmacy:manage");
        const h = hid(p);
        if (!h) throw badRequest("Dispensing requires a hospital pharmacist account");
        const d = dispenseSchema.parse(raw);
        const result = await db.$transaction(async (tx) => {
            const rx = await tx.prescription.findUnique({
                where: { id: prescriptionId },
                include: { items: { include: { medicine: true } }, appointment: true },
            });
            if (!rx) throw notFound("Prescription");
            if (!["ACTIVE", "PARTIALLY_DISPENSED"].includes(rx.status) || rx.validUntil < new Date())
                throw badRequest("This prescription cannot be dispensed (status/expiry)");
            const disp = await tx.medicationDispensing.create({
                data: { prescriptionId, pharmacistId: p.userId, hospitalId: h },
            });
            const charges: { type: "MEDICINE"; description: string; quantity: number; unitPrice: number }[] = [];
            for (const req of d.items.filter((i) => i.quantity > 0)) {
                const item = rx.items.find((i) => i.id === req.itemId);
                if (!item) throw badRequest("Unknown prescription item");
                if (req.quantity > item.quantity - item.dispensedQty)
                    throw badRequest(
                        `${item.medicine.name}: only ${item.quantity - item.dispensedQty} left to dispense`,
                    );
                let need = req.quantity;
                const batches = await tx.pharmacyInventory.findMany({
                    where: {
                        medicineId: item.medicineId,
                        hospitalId: h,
                        quantity: { gt: 0 },
                        expiryDate: { gt: new Date() },
                    },
                    orderBy: { expiryDate: "asc" },
                });
                for (const b of batches) {
                    if (!need) break;
                    const take = Math.min(b.quantity, need);
                    await tx.pharmacyInventory.update({ where: { id: b.id }, data: { quantity: { decrement: take } } });
                    await tx.dispensingItem.create({
                        data: { dispensingId: disp.id, inventoryId: b.id, medicineId: item.medicineId, quantity: take },
                    });
                    need -= take;
                }
                if (need) throw badRequest(`${item.medicine.name}: insufficient non-expired stock (short by ${need})`);
                await tx.prescriptionItem.update({
                    where: { id: item.id },
                    data: { dispensedQty: { increment: req.quantity } },
                });
                charges.push({
                    type: "MEDICINE",
                    description: `${item.medicine.name} ${item.dosage}`,
                    quantity: req.quantity,
                    unitPrice: Number(item.medicine.unitPrice),
                });
            }
            if (!charges.length) throw badRequest("Nothing to dispense");
            const fresh = await tx.prescriptionItem.findMany({ where: { prescriptionId } });
            await tx.prescription.update({
                where: { id: prescriptionId },
                data: {
                    status: fresh.every((i) => i.dispensedQty >= i.quantity) ? "DISPENSED" : "PARTIALLY_DISPENSED",
                },
            });
            const inv = await addCharges(tx, {
                patientId: rx.patientId,
                hospitalId: rx.appointment?.hospitalId ?? h,
                appointmentId: rx.appointmentId,
                items: charges,
            });
            return { dispensingId: disp.id, invoiceId: inv.id, patientId: rx.patientId };
        });
        const pat = await db.patient.findUnique({ where: { id: result.patientId } });
        if (pat)
            await notify(pat.userId, {
                type: "MEDICINE_DISPENSED",
                title: "Medicines dispensed",
                message: "Your prescription was dispensed. The charges were added to your invoice.",
                link: `/patient/billing/${result.invoiceId}`,
            });
        await audit(p, "DISPENSED", "Prescription", prescriptionId);
        return result;
    },
    async history(p: Principal, q: { page: number; size: number }) {
        await assertCan(p, "pharmacy:read");
        const h = hid(p);
        const where = h ? { hospitalId: h } : {};
        const [items, total] = await Promise.all([
            db.medicationDispensing.findMany({
                where,
                include: {
                    items: { include: { inventory: { include: { medicine: { select: { name: true } } } } } },
                    prescription: {
                        select: {
                            id: true,
                            patient: { select: { user: { select: { firstName: true, lastName: true } } } },
                        },
                    },
                },
                orderBy: { dispensedAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.medicationDispensing.count({ where }),
        ]);
        return { items, total };
    },
    async dashboard(p: Principal) {
        await assertCan(p, "pharmacy:read");
        const h = hid(p);
        const soon = new Date(Date.now() + 90 * 86400_000);
        const [queue, expiring, expired, dispensedToday, low] = await Promise.all([
            db.prescription.count({
                where: { status: { in: ["ACTIVE", "PARTIALLY_DISPENSED"] }, validUntil: { gte: new Date() } },
            }),
            db.pharmacyInventory.count({
                where: {
                    ...(h ? { hospitalId: h } : {}),
                    quantity: { gt: 0 },
                    expiryDate: { gt: new Date(), lt: soon },
                },
            }),
            db.pharmacyInventory.count({
                where: { ...(h ? { hospitalId: h } : {}), quantity: { gt: 0 }, expiryDate: { lte: new Date() } },
            }),
            db.medicationDispensing.count({
                where: {
                    ...(h ? { hospitalId: h } : {}),
                    dispensedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
            }),
            this.lowStock(p),
        ]);
        return { queue, expiring, expired, dispensedToday, lowStock: low.length };
    },
};

import "server-only";
import { db, type Tx } from "@/server/db";
import { Prisma } from "@prisma/client";
import { assertCan } from "@/server/authorization/rbac";
import { assertHospitalScope } from "@/server/authorization/access";
import { badRequest, forbidden, notFound } from "@/server/utilities/errors";
import { invoiceNumber, paymentReference } from "@/server/utilities/ids";
import { env } from "@/lib/configuration/env";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import { invoiceSchema, paymentSchema, refundSchema } from "@/lib/validations/billing";
import type { Principal } from "@/server/authorization/principal";

const r2 = (n: number) => Math.round(n * 100) / 100;
export function totals(items: { quantity: number; unitPrice: number }[], discount: number, taxRate = env.taxRate) {
    const subtotal = r2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
    const taxable = Math.max(subtotal - discount, 0);
    const tax = r2((taxable * taxRate) / 100);
    return { subtotal, discount, taxRate, tax, total: r2(taxable + tax) };
}
const include = {
    items: true,
    payments: { include: { refunds: true }, orderBy: { createdAt: "desc" } },
    patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
    hospital: { select: { id: true, name: true, address: true } },
} satisfies Prisma.InvoiceInclude;

/** Append lines to the unpaid invoice of an appointment (or create a new invoice) - used by dispensing and lab billing. */
export async function addCharges(
    tx: Tx,
    a: {
        patientId: number;
        hospitalId: number;
        appointmentId?: number | null;
        items: {
            type: "CONSULTATION" | "LABORATORY" | "MEDICINE" | "OTHER";
            description: string;
            quantity: number;
            unitPrice: number;
        }[];
    },
) {
    const existing = a.appointmentId
        ? await tx.invoice.findUnique({ where: { appointmentId: a.appointmentId }, include: { items: true } })
        : null;
    if (existing && ["ISSUED", "PARTIALLY_PAID", "DRAFT"].includes(existing.status)) {
        await tx.invoiceItem.createMany({
            data: a.items.map((i) => ({ invoiceId: existing.id, ...i, amount: r2(i.quantity * i.unitPrice) })),
        });
        const all = [
            ...existing.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
            ...a.items,
        ];
        const t = totals(all, Number(existing.discount), Number(existing.taxRate));
        return tx.invoice.update({
            where: { id: existing.id },
            data: {
                subtotal: t.subtotal,
                tax: t.tax,
                total: t.total,
                status:
                    Number(existing.paidAmount) >= t.total
                        ? "PAID"
                        : Number(existing.paidAmount) > 0
                          ? "PARTIALLY_PAID"
                          : "ISSUED",
            },
        });
    }
    const t = totals(a.items, 0);
    return tx.invoice.create({
        data: {
            number: invoiceNumber(),
            patientId: a.patientId,
            hospitalId: a.hospitalId,
            appointmentId: existing ? null : (a.appointmentId ?? null),
            status: "ISSUED",
            subtotal: t.subtotal,
            discount: 0,
            taxRate: t.taxRate,
            tax: t.tax,
            total: t.total,
            dueDate: new Date(Date.now() + 14 * 86400_000),
            items: { create: a.items.map((i) => ({ ...i, amount: r2(i.quantity * i.unitPrice) })) },
        },
    });
}

export const billingService = {
    /** Scenario 6 step 1-3: consultation + laboratory + medicine lines -> totals (discount/tax) -> issued invoice. Idempotent per appointment. */
    async generateForAppointment(appointmentId: number) {
        // Idempotent: an invoice may already exist (e.g. created by medicine dispensing) - only add consultation/lab lines once.
        const existing = await db.invoice.findUnique({ where: { appointmentId }, include: { items: true } });
        if (
            existing &&
            (existing.items.some((i) => i.type === "CONSULTATION") ||
                !["ISSUED", "PARTIALLY_PAID", "DRAFT"].includes(existing.status))
        )
            return null;
        const a = await db.appointment.findUniqueOrThrow({
            where: { id: appointmentId },
            include: {
                doctor: { include: { user: true } },
                patient: true,
                labRequests: { include: { test: true } },
                prescriptions: { include: { items: { include: { medicine: true } } } },
            },
        });
        const items = [
            {
                type: "CONSULTATION" as const,
                description: `Consultation - Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}`,
                quantity: 1,
                unitPrice: Number(a.doctor.consultationFee),
            },
            ...a.labRequests
                .filter((l) => l.status !== "CANCELLED")
                .map((l) => ({
                    type: "LABORATORY" as const,
                    description: l.test.name,
                    quantity: 1,
                    unitPrice: Number(l.test.price),
                })),
        ].filter((i) => i.unitPrice > 0);
        if (!items.length) return null;
        const inv = await db.$transaction((tx) =>
            addCharges(tx, { patientId: a.patientId, hospitalId: a.hospitalId, appointmentId, items }),
        );
        await notify(a.patient.userId, {
            type: "INVOICE_ISSUED",
            title: "Invoice issued",
            message: `Invoice ${inv.number} for ₹${inv.total} is ready.`,
            link: `/patient/billing/${inv.id}`,
            important: true,
        });
        return inv;
    },
    async create(p: Principal, raw: unknown) {
        await assertCan(p, "billing:manage");
        const d = invoiceSchema.parse(raw);
        assertHospitalScope(p, d.hospitalId);
        const t = totals(d.items, d.discount);
        const inv = await db.invoice.create({
            data: {
                number: invoiceNumber(),
                patientId: d.patientId,
                hospitalId: d.hospitalId,
                appointmentId: d.appointmentId ?? null,
                status: "ISSUED",
                subtotal: t.subtotal,
                discount: t.discount,
                taxRate: t.taxRate,
                tax: t.tax,
                total: t.total,
                dueDate: new Date(Date.now() + 14 * 86400_000),
                items: { create: d.items.map((i) => ({ ...i, amount: r2(i.quantity * i.unitPrice) })) },
            },
            include: { patient: true },
        });
        await notify(inv.patient.userId, {
            type: "INVOICE_ISSUED",
            title: "Invoice issued",
            message: `Invoice ${inv.number} for ₹${inv.total} is ready.`,
            link: `/patient/billing/${inv.id}`,
            important: true,
        });
        await audit(p, "INVOICE_CREATED", "Invoice", inv.id);
        return inv;
    },
    async list(p: Principal, q: { status?: string; q?: string; page: number; size: number }) {
        await assertCan(p, "billing:read");
        const where: Prisma.InvoiceWhereInput = {
            ...(q.status ? { status: q.status as never } : {}),
            ...(p.role === "PATIENT"
                ? { patientId: p.patientId ?? -1 }
                : p.role !== "SUPER_ADMIN" && p.hospitalId
                  ? { hospitalId: p.hospitalId }
                  : {}),
            ...(q.q
                ? {
                      OR: [
                          { number: { contains: q.q } },
                          {
                              patient: {
                                  user: { OR: [{ firstName: { contains: q.q } }, { lastName: { contains: q.q } }] },
                              },
                          },
                      ],
                  }
                : {}),
        };
        const [items, total] = await Promise.all([
            db.invoice.findMany({
                where,
                include,
                orderBy: { createdAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.invoice.count({ where }),
        ]);
        return { items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "billing:read");
        const inv = await db.invoice.findUnique({ where: { id }, include });
        if (!inv) throw notFound("Invoice");
        if (p.role === "PATIENT" && inv.patientId !== p.patientId) throw forbidden();
        assertHospitalScope(p, inv.hospitalId);
        return inv;
    },
    /** Scenario 6 steps 5-9: demo gateway (no external call, no card data stored). `last4 = 0002` simulates a declined card. */
    async pay(p: Principal, invoiceId: number, raw: unknown) {
        await assertCan(p, "billing:pay");
        const inv = await this.get(p, invoiceId);
        const d = paymentSchema.parse(raw);
        if (env.paymentProvider !== "demo")
            throw badRequest(`Payment provider "${env.paymentProvider}" is not implemented; set PAYMENT_PROVIDER=demo`);
        const remaining = r2(Number(inv.total) - Number(inv.paidAmount));
        if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status) || remaining <= 0)
            throw badRequest("This invoice is not payable");
        const amount = r2(d.amount ?? remaining);
        if (amount > remaining)
            throw badRequest("Amount exceeds the outstanding balance", { amount: `Maximum ${remaining}` });
        const declined = d.method === "CARD" && d.cardLast4 === "0002";
        const pay = await db.$transaction(async (tx) => {
            const pm = await tx.payment.create({
                data: {
                    invoiceId,
                    amount,
                    method: d.method,
                    provider: "demo",
                    reference: paymentReference(),
                    cardLast4: d.method === "CARD" ? d.cardLast4 : null,
                    status: declined ? "FAILED" : "SUCCEEDED",
                    failureReason: declined ? "Card declined by the demo gateway" : null,
                },
            });
            if (!declined) {
                const paid = r2(Number(inv.paidAmount) + amount);
                await tx.invoice.update({
                    where: { id: invoiceId },
                    data: { paidAmount: paid, status: paid >= Number(inv.total) ? "PAID" : "PARTIALLY_PAID" },
                });
            }
            return pm;
        });
        await notify(
            inv.patient.userId,
            declined
                ? {
                      type: "PAYMENT_FAILED",
                      title: "Payment failed",
                      message: `Payment ${pay.reference} for invoice ${inv.number} was declined.`,
                      link: `/patient/billing/${invoiceId}`,
                      important: true,
                  }
                : {
                      type: "PAYMENT_CONFIRMED",
                      title: "Payment received",
                      message: `₹${amount} received for invoice ${inv.number}. Reference ${pay.reference}.`,
                      link: `/patient/billing/${invoiceId}`,
                      important: true,
                  },
        );
        await audit(p, declined ? "PAYMENT_FAILED" : "PAYMENT_SUCCEEDED", "Payment", pay.id);
        return pay;
    },
    async refund(p: Principal, paymentId: number, raw: unknown) {
        await assertCan(p, "billing:manage");
        const d = refundSchema.parse(raw);
        const pay = await db.payment.findUnique({
            where: { id: paymentId },
            include: { refunds: true, invoice: { include: { patient: true } } },
        });
        if (!pay) throw notFound("Payment");
        assertHospitalScope(p, pay.invoice.hospitalId);
        if (pay.status !== "SUCCEEDED") throw badRequest("Only successful payments can be refunded");
        const refunded = pay.refunds.reduce((s, x) => s + Number(x.amount), 0);
        if (d.amount > Number(pay.amount) - refunded + 1e-9)
            throw badRequest("Refund exceeds the payment", { amount: "Too high" });
        await db.$transaction(async (tx) => {
            await tx.refund.create({ data: { paymentId, amount: d.amount, reason: d.reason } });
            const full = r2(refunded + d.amount) >= Number(pay.amount);
            if (full) await tx.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
            const paid = r2(Number(pay.invoice.paidAmount) - d.amount);
            await tx.invoice.update({
                where: { id: pay.invoiceId },
                data: {
                    paidAmount: paid,
                    status: paid <= 0 ? "REFUNDED" : paid >= Number(pay.invoice.total) ? "PAID" : "PARTIALLY_PAID",
                },
            });
        });
        await notify(pay.invoice.patient.userId, {
            type: "REFUND",
            title: "Refund processed",
            message: `₹${d.amount} refunded for invoice ${pay.invoice.number}.`,
            link: `/patient/billing/${pay.invoiceId}`,
            important: true,
        });
        await audit(p, "REFUND", "Payment", paymentId, { amount: d.amount });
    },
    async cancel(p: Principal, id: number) {
        await assertCan(p, "billing:manage");
        const inv = await this.get(p, id);
        if (Number(inv.paidAmount) > 0) throw badRequest("Refund payments before cancelling");
        await db.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
        await audit(p, "INVOICE_CANCELLED", "Invoice", id);
    },
    async payments(p: Principal, q: { page: number; size: number }) {
        await assertCan(p, "billing:read");
        const where: Prisma.PaymentWhereInput =
            p.role === "PATIENT"
                ? { invoice: { patientId: p.patientId ?? -1 } }
                : p.role !== "SUPER_ADMIN" && p.hospitalId
                  ? { invoice: { hospitalId: p.hospitalId } }
                  : {};
        const [items, total] = await Promise.all([
            db.payment.findMany({
                where,
                include: {
                    invoice: {
                        select: {
                            id: true,
                            number: true,
                            patient: { select: { user: { select: { firstName: true, lastName: true } } } },
                        },
                    },
                    refunds: true,
                },
                orderBy: { createdAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.payment.count({ where }),
        ]);
        return { items, total };
    },
    /** Billing reports (aggregations). */
    async report(p: Principal) {
        await assertCan(p, "report:read");
        const hid = p.role !== "SUPER_ADMIN" && p.hospitalId ? { hospitalId: p.hospitalId } : {};
        const [byStatus, sums, refunds, recent] = await Promise.all([
            db.invoice.groupBy({ by: ["status"], where: hid, _count: { _all: true }, _sum: { total: true } }),
            db.invoice.aggregate({ where: hid, _sum: { total: true, paidAmount: true, tax: true, discount: true } }),
            db.refund.aggregate({
                where: { payment: { invoice: hid } },
                _sum: { amount: true },
                _count: { _all: true },
            }),
            db.payment.groupBy({
                by: ["method"],
                where: { status: "SUCCEEDED", invoice: hid },
                _sum: { amount: true },
                _count: { _all: true },
            }),
        ]);
        return {
            byStatus: byStatus.map((s) => ({
                status: s.status,
                count: s._count._all,
                total: Number(s._sum.total ?? 0),
            })),
            billed: Number(sums._sum.total ?? 0),
            collected: Number(sums._sum.paidAmount ?? 0),
            tax: Number(sums._sum.tax ?? 0),
            discounts: Number(sums._sum.discount ?? 0),
            refunded: Number(refunds._sum.amount ?? 0),
            refundCount: refunds._count._all,
            byMethod: recent.map((m) => ({
                method: m.method,
                count: m._count._all,
                amount: Number(m._sum.amount ?? 0),
            })),
        };
    },
};

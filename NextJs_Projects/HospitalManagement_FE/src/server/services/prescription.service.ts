import "server-only";
import { db } from "@/server/db";
import { assertCan } from "@/server/authorization/rbac";
import { assertClinicalAccess, doctorTreatsPatient } from "@/server/authorization/access";
import { badRequest, forbidden, notFound } from "@/server/utilities/errors";
import { prescriptionSchema } from "@/lib/validations/clinical";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import type { Principal } from "@/server/authorization/principal";
import type { Prisma } from "@prisma/client";

export const rxInclude = {
    patient: { include: { user: { select: { firstName: true, lastName: true } } } },
    doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialization: true } },
    items: { include: { medicine: { select: { id: true, name: true, genericName: true, unitPrice: true } } } },
    dispensings: { orderBy: { dispensedAt: "desc" } },
} satisfies Prisma.PrescriptionInclude;

export const prescriptionService = {
    /** Scenario 5 (doctor part): validates, requires an existing treatment relationship, saves with items atomically, notifies the patient. */
    async create(p: Principal, raw: unknown) {
        await assertCan(p, "prescription:write");
        if (!p.doctorId) throw forbidden("Only doctors can prescribe");
        const d = prescriptionSchema.parse(raw);
        if (d.appointmentId) {
            const a = await db.appointment.findUnique({ where: { id: d.appointmentId } });
            if (!a || a.doctorId !== p.doctorId || a.patientId !== d.patientId)
                throw badRequest("Appointment does not belong to you and this patient");
        } else if (!(await doctorTreatsPatient(p.doctorId, d.patientId)))
            throw forbidden("This patient is not under your care");
        const meds = await db.medicine.findMany({
            where: { id: { in: d.items.map((i) => i.medicineId) }, active: true },
            select: { id: true },
        });
        if (meds.length !== d.items.length) throw badRequest("One or more medicines are unavailable");
        const rx = await db.prescription.create({
            data: {
                patientId: d.patientId,
                doctorId: p.doctorId,
                appointmentId: d.appointmentId ?? null,
                diagnosis: d.diagnosis,
                notes: d.notes || null,
                validUntil: new Date(Date.now() + d.validDays * 86400_000),
                items: {
                    create: d.items.map((i) => ({
                        medicineId: i.medicineId,
                        dosage: i.dosage,
                        frequency: i.frequency,
                        durationDays: i.durationDays,
                        quantity: i.quantity,
                        instructions: i.instructions || null,
                    })),
                },
            },
            include: { patient: true },
        });
        await notify(rx.patient.userId, {
            type: "PRESCRIPTION_CREATED",
            title: "New prescription",
            message: `Dr. ${p.name} issued a prescription (${d.items.length} medicine${d.items.length > 1 ? "s" : ""}).`,
            link: `/patient/prescriptions/${rx.id}`,
            important: true,
        });
        await audit(p, "PRESCRIPTION_CREATED", "Prescription", rx.id);
        return rx;
    },
    async update(p: Principal, id: number, raw: unknown) {
        await assertCan(p, "prescription:write");
        const cur = await db.prescription.findUnique({ where: { id }, include: { items: true } });
        if (!cur) throw notFound("Prescription");
        if (cur.doctorId !== p.doctorId) throw forbidden("Only the prescribing doctor can edit");
        if (cur.status !== "ACTIVE" || cur.items.some((i) => i.dispensedQty > 0))
            throw badRequest("Dispensed prescriptions cannot be edited");
        const d = prescriptionSchema.parse({ ...(raw as object), patientId: cur.patientId });
        await db.$transaction([
            db.prescriptionItem.deleteMany({ where: { prescriptionId: id } }),
            db.prescription.update({
                where: { id },
                data: {
                    diagnosis: d.diagnosis,
                    notes: d.notes || null,
                    items: {
                        create: d.items.map((i) => ({
                            medicineId: i.medicineId,
                            dosage: i.dosage,
                            frequency: i.frequency,
                            durationDays: i.durationDays,
                            quantity: i.quantity,
                            instructions: i.instructions || null,
                        })),
                    },
                },
            }),
        ]);
        await audit(p, "PRESCRIPTION_UPDATED", "Prescription", id);
    },
    async cancel(p: Principal, id: number) {
        await assertCan(p, "prescription:write");
        const cur = await db.prescription.findUnique({ where: { id } });
        if (!cur) throw notFound("Prescription");
        if (cur.doctorId !== p.doctorId) throw forbidden();
        if (cur.status !== "ACTIVE") throw badRequest("Only active prescriptions can be cancelled");
        await db.prescription.update({ where: { id }, data: { status: "CANCELLED" } });
        await audit(p, "PRESCRIPTION_CANCELLED", "Prescription", id);
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "prescription:read");
        const rx = await db.prescription.findUnique({ where: { id }, include: rxInclude });
        if (!rx) throw notFound("Prescription");
        if (p.role === "PHARMACIST") return rx; // pharmacy staff dispense; they see the prescription, not the full chart
        await assertClinicalAccess(p, rx.patientId);
        return rx;
    },
    async list(p: Principal, q: { patientId?: number; status?: string; page: number; size: number }) {
        await assertCan(p, "prescription:read");
        const where: Prisma.PrescriptionWhereInput = { ...(q.status ? { status: q.status as never } : {}) };
        if (p.role === "PATIENT") where.patientId = p.patientId ?? -1;
        else if (p.role === "DOCTOR") {
            where.doctorId = p.doctorId ?? -1;
            if (q.patientId) where.patientId = q.patientId;
        } else if (q.patientId) where.patientId = q.patientId;
        const [items, total] = await Promise.all([
            db.prescription.findMany({
                where,
                include: rxInclude,
                orderBy: { createdAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.prescription.count({ where }),
        ]);
        return { items, total };
    },
};

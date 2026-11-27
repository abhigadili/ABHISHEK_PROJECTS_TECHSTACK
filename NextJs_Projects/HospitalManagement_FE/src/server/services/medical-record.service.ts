import "server-only";
import { db } from "@/server/db";
import { assertCan } from "@/server/authorization/rbac";
import { assertClinicalAccess, doctorTreatsPatient } from "@/server/authorization/access";
import { badRequest, forbidden, notFound } from "@/server/utilities/errors";
import { readUpload, saveUpload } from "@/server/utilities/storage";
import { recordSchema } from "@/lib/validations/clinical";
import { audit } from "./audit.service";
import type { Principal } from "@/server/authorization/principal";
import type { Prisma } from "@prisma/client";

const include = {
    doctor: { include: { user: { select: { firstName: true, lastName: true } }, specialization: true } },
    documents: true,
} satisfies Prisma.MedicalRecordInclude;

/** Medical records: PATIENT own, DOCTOR treating, SUPER_ADMIN audited. Hospital admins/receptionists have no `record:read` at all. */
export const recordService = {
    async list(p: Principal, patientId: number, q: { type?: string; q?: string; page: number; size: number }) {
        await assertCan(p, "record:read");
        await assertClinicalAccess(p, patientId);
        const where: Prisma.MedicalRecordWhereInput = {
            patientId,
            deletedAt: null,
            ...(q.type ? { type: q.type as never } : {}),
            ...(q.q
                ? { OR: [{ title: { contains: q.q } }, { notes: { contains: q.q } }, { diagnosis: { contains: q.q } }] }
                : {}),
        };
        const [items, total] = await Promise.all([
            db.medicalRecord.findMany({
                where,
                include,
                orderBy: { recordedAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.medicalRecord.count({ where }),
        ]);
        return { items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "record:read");
        const r = await db.medicalRecord.findFirst({ where: { id, deletedAt: null }, include });
        if (!r) throw notFound("Record");
        await assertClinicalAccess(p, r.patientId);
        return r;
    },
    async create(p: Principal, raw: unknown) {
        await assertCan(p, "record:write");
        const d = recordSchema.parse(raw);
        if (p.role === "DOCTOR") {
            if (!p.doctorId) throw forbidden();
            if (d.appointmentId) {
                const a = await db.appointment.findUnique({ where: { id: d.appointmentId } });
                if (!a || a.doctorId !== p.doctorId || a.patientId !== d.patientId)
                    throw badRequest("Appointment does not belong to you and this patient");
            } else if (!(await doctorTreatsPatient(p.doctorId, d.patientId)))
                throw forbidden("This patient is not under your care");
        } else await assertClinicalAccess(p, d.patientId);
        const r = await db.medicalRecord.create({
            data: {
                patientId: d.patientId,
                doctorId: p.doctorId,
                appointmentId: d.appointmentId ?? null,
                type: d.type,
                title: d.title,
                diagnosis: d.diagnosis || null,
                notes: d.notes || null,
            },
        });
        await audit(p, "RECORD_CREATED", "MedicalRecord", r.id);
        return r;
    },
    async attach(p: Principal, recordId: number, file: File) {
        const r = await this.get(p, recordId);
        await assertCan(p, "record:write");
        if (p.role === "DOCTOR" && r.doctorId !== p.doctorId) throw forbidden("Only the author can attach documents");
        const f = await saveUpload(file);
        const doc = await db.medicalDocument.create({ data: { recordId, ...f } });
        await audit(p, "DOCUMENT_UPLOADED", "MedicalRecord", recordId);
        return doc;
    },
    async download(p: Principal, docId: number) {
        await assertCan(p, "record:read");
        const d = await db.medicalDocument.findUnique({ where: { id: docId }, include: { record: true } });
        if (!d) throw notFound("Document");
        await assertClinicalAccess(p, d.record.patientId);
        await audit(p, "DOCUMENT_DOWNLOADED", "MedicalDocument", docId);
        return { doc: d, data: await readUpload(d.storedName) };
    },
    async remove(p: Principal, id: number) {
        const r = await this.get(p, id);
        await assertCan(p, "record:write");
        if (p.role === "DOCTOR" && r.doctorId !== p.doctorId) throw forbidden();
        await db.medicalRecord.update({ where: { id }, data: { deletedAt: new Date() } });
        await audit(p, "RECORD_DELETED", "MedicalRecord", id);
    },
};

import "server-only";
import { db } from "@/server/db";
import { patientRepo } from "@/server/repositories/patient.repository";
import { assertCan } from "@/server/authorization/rbac";
import { assertPatientDemographicsAccess, doctorTreatsPatient } from "@/server/authorization/access";
import { notFound } from "@/server/utilities/errors";
import { patientProfileSchema } from "@/lib/validations/patient";
import { emptyToUndef } from "@/lib/validations/common";
import { audit } from "./audit.service";
import type { Principal } from "@/server/authorization/principal";
import type { PageQuery } from "@/lib/validations/common";

export const patientService = {
    /** Staff list. DOCTORs only see patients under their care; hospital staff see patients with activity at their hospital or registered without one. */
    async list(p: Principal, q: PageQuery) {
        await assertCan(p, "patient:read");
        const search = q.q
            ? {
                  OR: [
                      {
                          user: {
                              OR: [
                                  { firstName: { contains: q.q } },
                                  { lastName: { contains: q.q } },
                                  { email: { contains: q.q } },
                              ],
                          },
                      },
                      { mrn: { contains: q.q } },
                  ],
              }
            : {};
        const scope =
            p.role === "DOCTOR"
                ? {
                      OR: [
                          { appointments: { some: { doctorId: p.doctorId ?? -1 } } },
                          { records: { some: { doctorId: p.doctorId ?? -1 } } },
                      ],
                  }
                : {};
        const [items, total] = await patientRepo.list({ AND: [search, scope] }, q.page * q.size, q.size);
        return { items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, p.role === "PATIENT" ? "appointment:read" : "patient:read");
        await assertPatientDemographicsAccess(p, id);
        const x = await patientRepo.byId(id);
        if (!x) throw notFound("Patient");
        return x;
    },
    async me(p: Principal) {
        if (!p.patientId) throw notFound("Patient profile");
        const x = await patientRepo.byId(p.patientId);
        if (!x) throw notFound("Patient");
        return x;
    },
    async update(p: Principal, id: number, raw: unknown) {
        if (p.patientId !== id) await assertCan(p, "patient:write"); // patients edit themselves; staff need patient:write
        const d = patientProfileSchema.parse(raw);
        const cur = await patientRepo.byId(id);
        if (!cur) throw notFound("Patient");
        await patientRepo.update(
            id,
            cur.userId,
            { firstName: d.firstName, lastName: d.lastName, phone: d.phone },
            {
                dateOfBirth: new Date(d.dateOfBirth),
                gender: d.gender,
                bloodGroup: emptyToUndef(d.bloodGroup) ?? null,
                address: emptyToUndef(d.address) ?? null,
                city: emptyToUndef(d.city) ?? null,
                emergencyContactName: emptyToUndef(d.emergencyContactName) ?? null,
                emergencyContactPhone: emptyToUndef(d.emergencyContactPhone) ?? null,
                medicalHistory: emptyToUndef(d.medicalHistory) ?? null,
            },
        );
        await audit(p, "PATIENT_UPDATED", "Patient", id);
    },
    async remove(p: Principal, id: number) {
        await assertCan(p, "patient:write");
        const x = await patientRepo.byId(id);
        if (!x) throw notFound("Patient");
        await db.$transaction([
            db.patient.update({ where: { id }, data: { deletedAt: new Date() } }),
            db.user.update({ where: { id: x.userId }, data: { status: "SUSPENDED", deletedAt: new Date() } }),
        ]);
        await audit(p, "PATIENT_DELETED", "Patient", id);
    },
    /** Patient dashboard overview (own data only). */
    async dashboard(p: Principal) {
        if (!p.patientId) throw notFound("Patient profile");
        const now = new Date();
        const [upcoming, recentRx, labs, due] = await Promise.all([
            db.appointment.findMany({
                where: { patientId: p.patientId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } },
                orderBy: { startsAt: "asc" },
                take: 5,
                include: {
                    doctor: {
                        include: { user: { select: { firstName: true, lastName: true } }, specialization: true },
                    },
                    hospital: { select: { name: true } },
                },
            }),
            db.prescription.count({
                where: { patientId: p.patientId, status: { in: ["ACTIVE", "PARTIALLY_DISPENSED"] } },
            }),
            db.labRequest.count({ where: { patientId: p.patientId, report: { published: true } } }),
            db.invoice.aggregate({
                where: { patientId: p.patientId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
                _sum: { total: true, paidAmount: true },
                _count: { _all: true },
            }),
        ]);
        return {
            upcoming,
            activePrescriptions: recentRx,
            reports: labs,
            outstandingInvoices: due._count._all,
            outstandingAmount: Number(due._sum.total ?? 0) - Number(due._sum.paidAmount ?? 0),
        };
    },
    doctorTreatsPatient,
};

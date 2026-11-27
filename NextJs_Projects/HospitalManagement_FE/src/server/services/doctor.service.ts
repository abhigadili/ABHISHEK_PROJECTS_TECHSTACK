import "server-only";
import { db } from "@/server/db";
import { doctorRepo } from "@/server/repositories/doctor.repository";
import { assertCan, can } from "@/server/authorization/rbac";
import { assertHospitalScope } from "@/server/authorization/access";
import { hashPassword } from "@/server/auth/password";
import { audit } from "./audit.service";
import { badRequest, conflict, forbidden, notFound } from "@/server/utilities/errors";
import { doctorSchema, doctorProfileSchema, availabilitySchema, timeOffSchema } from "@/lib/validations/doctor";
import type { Principal } from "@/server/authorization/principal";
import type { PageQuery } from "@/lib/validations/common";

/** Patients see a doctor's public profile only - not the doctor's e-mail/phone. */
const stripContact = <T extends { user: { email: string; phone: string | null } }>(d: T): T => ({
    ...d,
    user: { ...d.user, email: "", phone: null },
});

export const doctorService = {
    /** Public directory (no auth): static/ISR pages. Only public profile facts (no e-mail/phone). */
    async listPublic(f: { specializationId?: number; hospitalId?: number; q?: string } = {}) {
        const [items] = await doctorRepo.list(
            {
                ...(f.specializationId ? { specializationId: f.specializationId } : {}),
                ...(f.hospitalId ? { assignments: { some: { hospitalId: f.hospitalId } } } : {}),
                ...(f.q
                    ? {
                          OR: [
                              { user: { OR: [{ firstName: { contains: f.q } }, { lastName: { contains: f.q } }] } },
                              { specialization: { name: { contains: f.q } } },
                          ],
                      }
                    : {}),
            },
            0,
            100,
        );
        return items.map(({ user, ...d }) => ({ ...d, user: { firstName: user.firstName, lastName: user.lastName } }));
    },
    async getPublic(id: number) {
        const d = await doctorRepo.byId(id);
        if (!d || !d.active) throw notFound("Doctor");
        return { ...d, user: { firstName: d.user.firstName, lastName: d.user.lastName } };
    },
    async list(p: Principal, q: PageQuery & { specializationId?: number; hospitalId?: number; departmentId?: number }) {
        await assertCan(p, "doctor:read");
        const hid =
            q.hospitalId ??
            (["HOSPITAL_ADMIN", "RECEPTIONIST", "LAB_STAFF"].includes(p.role)
                ? (p.hospitalId ?? undefined)
                : undefined);
        const orderBy =
            q.sort === "experience"
                ? { experienceYears: q.dir }
                : q.sort === "fee"
                  ? { consultationFee: q.dir }
                  : { user: { lastName: q.dir } };
        const [items, total] = await doctorRepo.list(
            {
                ...(q.specializationId ? { specializationId: q.specializationId } : {}),
                ...(hid || q.departmentId
                    ? {
                          assignments: {
                              some: {
                                  ...(hid ? { hospitalId: hid } : {}),
                                  ...(q.departmentId ? { departmentId: q.departmentId } : {}),
                              },
                          },
                      }
                    : {}),
                ...(q.q
                    ? {
                          OR: [
                              { user: { OR: [{ firstName: { contains: q.q } }, { lastName: { contains: q.q } }] } },
                              { specialization: { name: { contains: q.q } } },
                          ],
                      }
                    : {}),
            },
            q.page * q.size,
            q.size,
            orderBy as never,
        );
        return { items: p.role === "PATIENT" ? items.map(stripContact) : items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "doctor:read");
        const d = await doctorRepo.byId(id);
        if (!d) throw notFound("Doctor");
        return p.role === "PATIENT" ? stripContact(d) : d;
    },
    specializations: () => doctorRepo.specializations(),

    /** Doctor registration: User + Doctor + hospital assignment in one transaction (DOCTOR role). */
    async register(p: Principal, raw: unknown) {
        await assertCan(p, "doctor:manage");
        const d = doctorSchema.parse(raw);
        assertHospitalScope(p, d.hospitalId);
        if (await db.user.findUnique({ where: { email: d.email } }))
            throw conflict("E-mail already registered", { email: "Already registered" });
        if (await db.doctor.findUnique({ where: { licenseNumber: d.licenseNumber } }))
            throw conflict("Licence number already registered", { licenseNumber: "Already registered" });
        const role = await db.role.findUniqueOrThrow({ where: { key: "DOCTOR" } });
        const hash = d.createLogin ? await hashPassword(d.password) : null;
        const doc = await db.$transaction(async (tx) => {
            const u = await tx.user.create({
                data: {
                    email: d.email,
                    passwordHash: hash,
                    firstName: d.firstName,
                    lastName: d.lastName,
                    phone: d.phone || null,
                    roleId: role.id,
                    status: hash ? "ACTIVE" : "PENDING",
                },
            });
            await tx.notificationPreference.create({ data: { userId: u.id } });
            const x = await doctorRepo.create(tx, {
                userId: u.id,
                specializationId: d.specializationId,
                licenseNumber: d.licenseNumber,
                qualifications: d.qualifications || null,
                experienceYears: d.experienceYears,
                consultationFee: d.consultationFee,
                bio: d.bio || null,
            });
            await doctorRepo.assign(tx, x.id, d.hospitalId, d.departmentId || null);
            return x;
        });
        await audit(p, "DOCTOR_REGISTERED", "Doctor", doc.id);
        return doc;
    },
    async updateProfile(p: Principal, id: number, raw: unknown) {
        const own = p.doctorId === id;
        if (!own) await assertCan(p, "doctor:manage");
        const d = doctorProfileSchema.parse(raw);
        await db.user.update({
            where: { id: (await db.doctor.findUniqueOrThrow({ where: { id } })).userId },
            data: { phone: d.phone || null },
        });
        return doctorRepo.update(id, {
            qualifications: d.qualifications || null,
            experienceYears: d.experienceYears,
            consultationFee: d.consultationFee,
            bio: d.bio || null,
        });
    },
    async assign(p: Principal, doctorId: number, hospitalId: number, departmentId: number | null) {
        await assertCan(p, "doctor:manage");
        assertHospitalScope(p, hospitalId);
        return db.$transaction((tx) => doctorRepo.assign(tx, doctorId, hospitalId, departmentId));
    },
    async deactivate(p: Principal, id: number) {
        await assertCan(p, "doctor:manage");
        const d = await doctorRepo.byId(id);
        if (!d) throw notFound("Doctor");
        await db.$transaction([
            db.doctor.update({ where: { id }, data: { active: false, deletedAt: new Date() } }),
            db.user.update({ where: { id: d.userId }, data: { status: "SUSPENDED" } }),
        ]);
        await audit(p, "DOCTOR_DEACTIVATED", "Doctor", id);
    },

    /** Availability: a doctor edits only their own (or an admin with doctor:manage, within their hospital). */
    async getAvailability(p: Principal, doctorId: number) {
        await assertCan(p, "doctor:read");
        return doctorRepo.availability(doctorId);
    },
    async setAvailability(p: Principal, doctorId: number, raw: unknown) {
        const own = p.doctorId === doctorId;
        if (!own) {
            if (!(await can(p, "doctor:manage"))) throw forbidden();
        } else await assertCan(p, "doctor:availability");
        const d = availabilitySchema.parse(raw);
        assertHospitalScope(p, d.hospitalId);
        if (!(await doctorRepo.assignment(doctorId, d.hospitalId)))
            throw badRequest("The doctor is not assigned to that hospital");
        await doctorRepo.replaceAvailability(
            doctorId,
            d.hospitalId,
            d.days.map((x) => ({
                doctorId,
                hospitalId: d.hospitalId,
                dayOfWeek: x.dayOfWeek,
                startTime: x.startTime,
                endTime: x.endTime,
                slotMinutes: x.slotMinutes,
                breakStart: x.breakStart || null,
                breakEnd: x.breakEnd || null,
            })),
        );
    },
    async addTimeOff(p: Principal, doctorId: number, raw: unknown) {
        if (p.doctorId !== doctorId) await assertCan(p, "doctor:manage");
        else await assertCan(p, "doctor:availability");
        const d = timeOffSchema.parse(raw);
        return doctorRepo.addTimeOff(doctorId, new Date(d.date + "T00:00:00.000Z"), d.reason);
    },
    async removeTimeOff(p: Principal, doctorId: number, id: number) {
        if (p.doctorId !== doctorId) await assertCan(p, "doctor:manage");
        await doctorRepo.removeTimeOff(id, doctorId);
    },
};

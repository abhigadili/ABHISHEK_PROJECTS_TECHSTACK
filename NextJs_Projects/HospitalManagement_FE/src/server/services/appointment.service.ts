import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { appointmentRepo } from "@/server/repositories/appointment.repository";
import { doctorRepo } from "@/server/repositories/doctor.repository";
import { assertCan, can } from "@/server/authorization/rbac";
import { assertHospitalScope } from "@/server/authorization/access";
import { badRequest, conflict, forbidden, notFound } from "@/server/utilities/errors";
import { confirmationCode } from "@/server/utilities/ids";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import { billingService } from "./billing.service";
import { bookAppointmentSchema, rescheduleSchema, statusSchema } from "@/lib/validations/appointment";
import type { Principal } from "@/server/authorization/principal";

const MIN_NOTICE_MS = 2 * 3600_000; // patients may cancel/reschedule up to 2 hours before the visit
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export interface Slot {
    startsAt: string;
    endsAt: string;
    label: string;
    available: boolean;
}

/** Build the day's slot grid from the doctor's weekly rule, minus break, time off, booked appointments and the past. */
export async function generateSlots(doctorId: number, hospitalId: number, date: string): Promise<Slot[]> {
    const day = new Date(`${date}T00:00:00`);
    if (Number.isNaN(day.getTime())) throw badRequest("Invalid date");
    const rule = (await doctorRepo.availability(doctorId, hospitalId)).find((r) => r.dayOfWeek === day.getDay());
    if (!rule || (await doctorRepo.timeOff(doctorId, new Date(`${date}T00:00:00.000Z`)))) return [];
    const end = new Date(day.getTime() + 86400_000);
    const booked = await appointmentRepo.booked(doctorId, day, end);
    const out: Slot[] = [];
    for (let m = toMin(rule.startTime); m + rule.slotMinutes <= toMin(rule.endTime); m += rule.slotMinutes) {
        if (
            rule.breakStart &&
            rule.breakEnd &&
            m < toMin(rule.breakEnd) &&
            m + rule.slotMinutes > toMin(rule.breakStart)
        )
            continue;
        const s = new Date(day.getTime() + m * 60_000),
            e = new Date(s.getTime() + rule.slotMinutes * 60_000);
        out.push({
            startsAt: s.toISOString(),
            endsAt: e.toISOString(),
            label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
            available: s.getTime() > Date.now() && !booked.some((b) => b.startsAt < e && b.endsAt > s),
        });
    }
    return out;
}

export const appointmentService = {
    slots: (doctorId: number, hospitalId: number, date: string) => generateSlots(doctorId, hospitalId, date),

    async list(
        p: Principal,
        q: {
            status?: string;
            from?: string;
            to?: string;
            doctorId?: number;
            patientId?: number;
            scope?: string;
            q?: string;
            page: number;
            size: number;
            dir: "asc" | "desc";
        },
    ) {
        await assertCan(p, "appointment:read");
        const where: Prisma.AppointmentWhereInput = {
            ...(q.status ? { status: q.status as never } : {}),
            ...(q.from || q.to
                ? {
                      startsAt: {
                          ...(q.from ? { gte: new Date(q.from + "T00:00:00") } : {}),
                          ...(q.to ? { lt: new Date(new Date(q.to + "T00:00:00").getTime() + 86400_000) } : {}),
                      },
                  }
                : {}),
        };
        if (q.scope === "upcoming") where.startsAt = { gte: new Date() };
        if (q.scope === "past") where.startsAt = { lt: new Date() };
        if (p.role === "PATIENT") where.patientId = p.patientId ?? -1;
        else if (p.role === "DOCTOR") where.doctorId = p.doctorId ?? -1;
        else {
            if (p.role !== "SUPER_ADMIN" && p.hospitalId) where.hospitalId = p.hospitalId;
            if (q.doctorId) where.doctorId = q.doctorId;
            if (q.patientId) where.patientId = q.patientId;
        }
        if (q.q)
            where.OR = [
                { patient: { user: { OR: [{ firstName: { contains: q.q } }, { lastName: { contains: q.q } }] } } },
                { doctor: { user: { lastName: { contains: q.q } } } },
                { confirmationCode: { contains: q.q } },
            ];
        const [items, total] = await appointmentRepo.list(where, q.page * q.size, q.size, q.dir);
        return { items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "appointment:read");
        const a = await appointmentRepo.byId(id);
        if (!a) throw notFound("Appointment");
        if (p.role === "PATIENT" && a.patientId !== p.patientId) throw forbidden();
        if (p.role === "DOCTOR" && a.doctorId !== p.doctorId) throw forbidden();
        assertHospitalScope(p, a.hospitalId);
        return a;
    },

    /** Scenario 2: validates the slot, blocks duplicate/overlapping bookings inside a transaction (UNIQUE slotKey is the race-proof guard). */
    async book(p: Principal, raw: unknown) {
        await assertCan(p, "appointment:book");
        const d = bookAppointmentSchema.parse(raw);
        const patientId = p.role === "PATIENT" ? p.patientId : d.patientId;
        if (!patientId) throw badRequest("Select the patient", { patientId: "Required" });
        if (p.role !== "PATIENT") assertHospitalScope(p, d.hospitalId);
        if (!(await doctorRepo.assignment(d.doctorId, d.hospitalId)))
            throw badRequest("The doctor does not work at this hospital");
        const startsAt = new Date(d.startsAt);
        const slot = (await generateSlots(d.doctorId, d.hospitalId, startsAt.toLocaleDateString("sv"))).find(
            (s) => s.startsAt === startsAt.toISOString(),
        );
        if (!slot) throw badRequest("That time is not an offered slot", { startsAt: "Not a valid slot" });
        if (!slot.available) throw conflict("That slot is no longer available", { startsAt: "Slot taken" });
        const endsAt = new Date(slot.endsAt);
        try {
            const appt = await db.$transaction(async (tx) => {
                if (await appointmentRepo.overlapping(tx, { doctorId: d.doctorId }, startsAt, endsAt))
                    throw conflict("The doctor already has an appointment in that time");
                if (await appointmentRepo.overlapping(tx, { patientId }, startsAt, endsAt))
                    throw conflict("You already have an appointment that overlaps this time");
                return tx.appointment.create({
                    data: {
                        patientId,
                        doctorId: d.doctorId,
                        hospitalId: d.hospitalId,
                        startsAt,
                        endsAt,
                        status: "CONFIRMED",
                        reason: d.reason || null,
                        slotKey: `${d.doctorId}:${startsAt.toISOString()}`,
                        confirmationCode: confirmationCode(),
                    },
                    include: { doctor: { include: { user: true } }, patient: { include: { user: true } } },
                });
            });
            const when = startsAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
            await notify(appt.patient.userId, {
                type: "APPOINTMENT_CONFIRMED",
                title: "Appointment confirmed",
                message: `Dr. ${appt.doctor.user.lastName} on ${when}. Confirmation code ${appt.confirmationCode}.`,
                link: `/patient/appointments/${appt.id}`,
                important: true,
            });
            await notify(appt.doctor.userId, {
                type: "APPOINTMENT_NEW",
                title: "New appointment",
                message: `${appt.patient.user.firstName} ${appt.patient.user.lastName} booked ${when}.`,
                link: `/doctor/appointments/${appt.id}`,
            });
            await audit(p, "APPOINTMENT_BOOKED", "Appointment", appt.id);
            return appt;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
                throw conflict("That slot was just booked by someone else", { startsAt: "Slot taken" });
            throw e;
        }
    },

    async setStatus(p: Principal, id: number, raw: unknown) {
        const a = await this.get(p, id);
        const { status, reason } = statusSchema.parse(raw);
        if (a.status === "CANCELLED" || a.status === "COMPLETED")
            throw badRequest(`A ${a.status.toLowerCase()} appointment cannot be changed`);
        if (p.role === "PATIENT") {
            if (status !== "CANCELLED") throw forbidden("Patients can only cancel");
            if (a.startsAt.getTime() - Date.now() < MIN_NOTICE_MS)
                throw badRequest("Appointments can only be cancelled up to 2 hours before the visit");
        } else if (p.role === "DOCTOR") {
            if (a.doctorId !== p.doctorId) throw forbidden();
        } else await assertCan(p, "appointment:manage");
        const upd = await db.appointment.update({
            where: { id },
            data: {
                status,
                cancelReason: status === "CANCELLED" ? reason || null : undefined,
                slotKey: status === "CANCELLED" ? null : a.slotKey,
            },
        }); // freeing slotKey re-opens the slot
        const who = [a.patient.user.id, a.doctor.user.id].filter((u) => u !== p.userId);
        if (status === "CANCELLED")
            await notify(who, {
                type: "APPOINTMENT_CANCELLED",
                title: "Appointment cancelled",
                message: `The appointment on ${a.startsAt.toLocaleString("en-IN")} was cancelled.${reason ? " Reason: " + reason : ""}`,
                link: "/patient/appointments",
                important: true,
            });
        else
            await notify(a.patient.user.id, {
                type: "APPOINTMENT_STATUS",
                title: `Appointment ${status.toLowerCase().replace("_", " ")}`,
                message: `Your appointment on ${a.startsAt.toLocaleString("en-IN")} is now ${status}.`,
                link: `/patient/appointments/${id}`,
            });
        if (status === "COMPLETED")
            await billingService.generateForAppointment(id).catch((e) => console.error("[billing:auto]", e));
        await audit(p, "APPOINTMENT_" + status, "Appointment", id);
        return upd;
    },

    async reschedule(p: Principal, id: number, raw: unknown) {
        const a = await this.get(p, id);
        const { startsAt: s } = rescheduleSchema.parse(raw);
        if (p.role === "PATIENT") {
            if (a.startsAt.getTime() - Date.now() < MIN_NOTICE_MS)
                throw badRequest("Appointments can only be rescheduled up to 2 hours before the visit");
        } else if (p.role !== "DOCTOR") await assertCan(p, "appointment:manage");
        else if (a.doctorId !== p.doctorId) throw forbidden();
        if (!["PENDING", "CONFIRMED"].includes(a.status))
            throw badRequest("Only pending or confirmed appointments can be rescheduled");
        const startsAt = new Date(s);
        const slot = (await generateSlots(a.doctorId, a.hospitalId, startsAt.toLocaleDateString("sv"))).find(
            (x) => x.startsAt === startsAt.toISOString(),
        );
        if (!slot || !slot.available) throw conflict("That slot is not available", { startsAt: "Slot not available" });
        try {
            const upd = await db.$transaction(async (tx) => {
                const endsAt = new Date(slot.endsAt);
                if (await appointmentRepo.overlapping(tx, { patientId: a.patientId }, startsAt, endsAt, id))
                    throw conflict("You already have an appointment at that time");
                return tx.appointment.update({
                    where: { id },
                    data: { startsAt, endsAt, slotKey: `${a.doctorId}:${startsAt.toISOString()}`, status: "CONFIRMED" },
                });
            });
            await notify(
                [a.patient.user.id, a.doctor.user.id].filter((u) => u !== p.userId),
                {
                    type: "APPOINTMENT_RESCHEDULED",
                    title: "Appointment rescheduled",
                    message: `Moved to ${startsAt.toLocaleString("en-IN")}.`,
                    link: `/patient/appointments/${id}`,
                    important: true,
                },
            );
            await audit(p, "APPOINTMENT_RESCHEDULED", "Appointment", id);
            return upd;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
                throw conflict("That slot was just booked by someone else");
            throw e;
        }
    },

    /** Appointment reminders for visits in the next 24 h (run on demand by an admin; wire to a scheduler in production). */
    async sendDueReminders(p: Principal) {
        await assertCan(p, "report:read");
        const due = await db.appointment.findMany({
            where: {
                status: "CONFIRMED",
                startsAt: { gt: new Date(), lt: new Date(Date.now() + 24 * 3600_000) },
                ...(p.role !== "SUPER_ADMIN" && p.hospitalId ? { hospitalId: p.hospitalId } : {}),
            },
            include: { patient: true, doctor: { include: { user: true } } },
        });
        for (const a of due) {
            const sent = await db.notification.count({
                where: {
                    userId: a.patient.userId,
                    type: "APPOINTMENT_REMINDER",
                    link: `/patient/appointments/${a.id}`,
                },
            });
            if (!sent)
                await notify(a.patient.userId, {
                    type: "APPOINTMENT_REMINDER",
                    title: "Appointment reminder",
                    message: `Tomorrow/today ${a.startsAt.toLocaleString("en-IN")} with Dr. ${a.doctor.user.lastName}.`,
                    link: `/patient/appointments/${a.id}`,
                });
        }
        return due.length;
    },
    async doctorDashboard(p: Principal) {
        if (!p.doctorId) throw notFound("Doctor profile");
        const t0 = new Date();
        t0.setHours(0, 0, 0, 0);
        const [today, upcoming, patients, labs] = await Promise.all([
            db.appointment.findMany({
                where: {
                    doctorId: p.doctorId,
                    startsAt: { gte: t0, lt: new Date(t0.getTime() + 86400_000) },
                    status: { not: "CANCELLED" },
                },
                orderBy: { startsAt: "asc" },
                include: {
                    patient: { include: { user: { select: { firstName: true, lastName: true } } } },
                    hospital: { select: { name: true } },
                },
            }),
            db.appointment.count({
                where: {
                    doctorId: p.doctorId,
                    startsAt: { gte: new Date() },
                    status: { in: ["PENDING", "CONFIRMED"] },
                },
            }),
            db.appointment.findMany({
                where: { doctorId: p.doctorId },
                distinct: ["patientId"],
                select: { patientId: true },
            }),
            db.labRequest.count({ where: { doctorId: p.doctorId, report: { published: true } } }),
        ]);
        return { today, upcoming, patients: patients.length, publishedReports: labs };
    },
    can,
};

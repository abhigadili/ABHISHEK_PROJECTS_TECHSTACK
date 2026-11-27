import "server-only";
import { hospitalRepo } from "@/server/repositories/hospital.repository";
import { assertCan } from "@/server/authorization/rbac";
import { assertHospitalScope } from "@/server/authorization/access";
import { audit } from "./audit.service";
import { notFound } from "@/server/utilities/errors";
import { db } from "@/server/db";
import { hospitalSchema, departmentSchema, type HospitalInput } from "@/lib/validations/hospital";
import type { Principal } from "@/server/authorization/principal";
import type { PageQuery } from "@/lib/validations/common";

const slugify = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
const toData = (d: HospitalInput) => ({
    name: d.name,
    code: d.code,
    description: d.description || null,
    address: d.address || null,
    city: d.city || null,
    phone: d.phone || null,
    email: d.email || null,
    facilities: d.facilities,
    operatingHours: d.operatingHours ? { text: d.operatingHours } : undefined,
    parentId: d.parentId ?? null,
    active: d.active,
});

export const hospitalService = {
    /** Public (no auth): used by statically generated / ISR pages. Returns only public facts. */
    async listPublic(q: Partial<PageQuery> & { city?: string } = {}) {
        const [items, total] = await hospitalRepo.list(
            {
                active: true,
                parentId: null,
                ...(q.city ? { city: q.city } : {}),
                ...(q.q ? { OR: [{ name: { contains: q.q } }, { city: { contains: q.q } }] } : {}),
            },
            (q.page ?? 0) * (q.size ?? 50),
            q.size ?? 50,
        );
        return { items, total };
    },
    async getPublicBySlug(slug: string) {
        const h = await hospitalRepo.bySlug(slug);
        if (!h) throw notFound("Hospital");
        return h;
    },
    async list(p: Principal, q: PageQuery & { city?: string }) {
        await assertCan(p, "hospital:read");
        const scope =
            p.role !== "SUPER_ADMIN" && p.role !== "PATIENT" && p.role !== "DOCTOR" && p.hospitalId
                ? { id: p.hospitalId }
                : {};
        const [items, total] = await hospitalRepo.list(
            {
                ...scope,
                ...(q.city ? { city: q.city } : {}),
                ...(q.q ? { OR: [{ name: { contains: q.q } }, { city: { contains: q.q } }] } : {}),
            },
            q.page * q.size,
            q.size,
        );
        return { items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "hospital:read");
        const h = await hospitalRepo.byId(id);
        if (!h) throw notFound("Hospital");
        return h;
    },
    async create(p: Principal, raw: unknown) {
        await assertCan(p, "hospital:manage");
        if (p.role !== "SUPER_ADMIN") {
            const { forbidden } = await import("@/server/utilities/errors");
            throw forbidden("Only a Super Admin can register hospitals");
        }
        const d = hospitalSchema.parse(raw);
        let slug = slugify(d.name),
            n = 1;
        while (await hospitalRepo.slugExists(slug)) slug = `${slugify(d.name)}-${++n}`;
        const h = await hospitalRepo.create({ ...toData(d), slug } as never);
        await audit(p, "HOSPITAL_CREATED", "Hospital", h.id);
        return h;
    },
    async update(p: Principal, id: number, raw: unknown) {
        await assertCan(p, "hospital:manage");
        assertHospitalScope(p, id);
        const d = hospitalSchema.parse(raw);
        const h = await hospitalRepo.update(id, toData(d) as never);
        await audit(p, "HOSPITAL_UPDATED", "Hospital", id);
        return h;
    },
    async remove(p: Principal, id: number) {
        await assertCan(p, "hospital:manage");
        assertHospitalScope(p, id);
        await hospitalRepo.softDelete(id);
        await audit(p, "HOSPITAL_DELETED", "Hospital", id);
    },
    async addDepartment(p: Principal, hospitalId: number, raw: unknown) {
        await assertCan(p, "hospital:manage");
        assertHospitalScope(p, hospitalId);
        const d = departmentSchema.parse(raw);
        return hospitalRepo.addDepartment(hospitalId, { name: d.name, description: d.description || undefined });
    },
    async removeDepartment(p: Principal, id: number) {
        await assertCan(p, "hospital:manage");
        const dep = await hospitalRepo.department(id);
        if (!dep) throw notFound("Department");
        assertHospitalScope(p, dep.hospitalId);
        await hospitalRepo.updateDepartment(id, { active: false });
    },
    async staff(p: Principal, hospitalId: number) {
        await assertCan(p, "user:manage");
        assertHospitalScope(p, hospitalId);
        return hospitalRepo.staff(hospitalId);
    },
    /** Hospital administration dashboard figures (aggregations). */
    async dashboard(p: Principal, hospitalId: number) {
        await assertCan(p, "hospital:read");
        assertHospitalScope(p, hospitalId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 86400_000);
        const [departments, doctors, staff, apptToday, apptPending, revenue, byStatus] = await Promise.all([
            db.department.count({ where: { hospitalId, active: true } }),
            db.doctorHospitalAssignment.count({ where: { hospitalId } }),
            db.user.count({ where: { hospitalId, deletedAt: null } }),
            db.appointment.count({
                where: { hospitalId, startsAt: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } },
            }),
            db.appointment.count({ where: { hospitalId, status: "PENDING" } }),
            db.invoice.aggregate({ where: { hospitalId }, _sum: { paidAmount: true, total: true } }),
            db.appointment.groupBy({ by: ["status"], where: { hospitalId }, _count: { _all: true } }),
        ]);
        return {
            departments,
            doctors,
            staff,
            appointmentsToday: apptToday,
            appointmentsPending: apptPending,
            revenuePaid: Number(revenue._sum.paidAmount ?? 0),
            revenueBilled: Number(revenue._sum.total ?? 0),
            byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
        };
    },
};

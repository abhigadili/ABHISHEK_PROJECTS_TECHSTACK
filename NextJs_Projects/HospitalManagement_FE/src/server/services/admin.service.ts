import "server-only";
import { db } from "@/server/db";
import { assertCan, invalidatePermissionCache } from "@/server/authorization/rbac";
import { hashPassword } from "@/server/auth/password";
import { revokeAllSessions } from "@/server/auth/session";
import { badRequest, conflict, forbidden, notFound } from "@/server/utilities/errors";
import { audit } from "./audit.service";
import { PERMISSIONS } from "@/lib/constants/rbac";
import { rolePermissionSchema, userCreateSchema, userUpdateSchema } from "@/lib/validations/admin";
import type { Principal } from "@/server/authorization/principal";
import { Prisma } from "@prisma/client";

const userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    status: true,
    hospitalId: true,
    lastLoginAt: true,
    createdAt: true,
    role: { select: { key: true, name: true } },
    hospital: { select: { name: true } },
    mfa: { select: { enabled: true } },
} satisfies Prisma.UserSelect;

/** User, role/permission management, audit log and system configuration (Super Admin / Hospital Admin). */
export const adminService = {
    async listUsers(p: Principal, q: { q?: string; role?: string; status?: string; page: number; size: number }) {
        await assertCan(p, "user:manage");
        const where: Prisma.UserWhereInput = {
            deletedAt: null,
            ...(p.role !== "SUPER_ADMIN"
                ? { hospitalId: p.hospitalId ?? -1, role: { key: { notIn: ["SUPER_ADMIN", "PATIENT"] } } }
                : {}),
            ...(q.role ? { role: { key: q.role } } : {}),
            ...(q.status ? { status: q.status as never } : {}),
            ...(q.q
                ? {
                      OR: [
                          { firstName: { contains: q.q } },
                          { lastName: { contains: q.q } },
                          { email: { contains: q.q } },
                      ],
                  }
                : {}),
        };
        const [items, total] = await Promise.all([
            db.user.findMany({
                where,
                select: userSelect,
                orderBy: { createdAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.user.count({ where }),
        ]);
        return { items, total };
    },
    async createUser(p: Principal, raw: unknown) {
        await assertCan(p, "user:manage");
        const d = userCreateSchema.parse(raw);
        if (p.role !== "SUPER_ADMIN") {
            if (["SUPER_ADMIN", "HOSPITAL_ADMIN", "PATIENT", "DOCTOR"].includes(d.role))
                throw forbidden("You can only create hospital staff accounts");
            if (d.hospitalId !== p.hospitalId) throw forbidden("You can only create staff for your own hospital");
        }
        if (d.role === "PATIENT" || d.role === "DOCTOR")
            throw badRequest("Use the patient/doctor registration forms for this role");
        if (await db.user.findUnique({ where: { email: d.email } }))
            throw conflict("E-mail already registered", { email: "Already registered" });
        const role = await db.role.findUniqueOrThrow({ where: { key: d.role } });
        const u = await db.user.create({
            data: {
                email: d.email,
                firstName: d.firstName,
                lastName: d.lastName,
                phone: d.phone || null,
                passwordHash: await hashPassword(d.password),
                roleId: role.id,
                hospitalId: d.hospitalId || null,
                notificationPref: { create: {} },
            },
            select: userSelect,
        });
        await audit(p, "USER_CREATED", "User", u.id, { role: d.role });
        return u;
    },
    async updateUser(p: Principal, id: number, raw: unknown) {
        await assertCan(p, "user:manage");
        const d = userUpdateSchema.parse(raw);
        const u = await db.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
        if (!u) throw notFound("User");
        if (p.role !== "SUPER_ADMIN") {
            if (u.hospitalId !== p.hospitalId || ["SUPER_ADMIN", "HOSPITAL_ADMIN"].includes(u.role.key) || d.role)
                throw forbidden();
        }
        if (id === p.userId && d.status && d.status !== "ACTIVE")
            throw badRequest("You cannot suspend your own account");
        const role = d.role ? await db.role.findUniqueOrThrow({ where: { key: d.role } }) : null;
        const upd = await db.user.update({
            where: { id },
            data: {
                ...(d.status ? { status: d.status } : {}),
                ...(role ? { roleId: role.id } : {}),
                ...(d.hospitalId !== undefined ? { hospitalId: d.hospitalId || null } : {}),
            },
            select: userSelect,
        });
        if (d.status === "SUSPENDED" || role) await revokeAllSessions(id); // force re-authentication with the new state
        await audit(p, "USER_UPDATED", "User", id, d as never);
        return upd;
    },
    async deleteUser(p: Principal, id: number) {
        await assertCan(p, "user:manage");
        if (p.role !== "SUPER_ADMIN") throw forbidden();
        if (id === p.userId) throw badRequest("You cannot delete yourself");
        await db.user.update({ where: { id }, data: { deletedAt: new Date(), status: "SUSPENDED" } });
        await revokeAllSessions(id);
        await audit(p, "USER_DELETED", "User", id);
    },

    async roles(p: Principal) {
        await assertCan(p, "role:manage");
        return db.role.findMany({
            include: {
                permissions: { select: { permission: { select: { key: true } } } },
                _count: { select: { users: true } },
            },
            orderBy: { id: "asc" },
        });
    },
    permissionCatalog: () => Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })),
    async setRolePermissions(p: Principal, roleKey: string, raw: unknown) {
        await assertCan(p, "role:manage");
        const d = rolePermissionSchema.parse(raw);
        const role = await db.role.findUnique({ where: { key: roleKey } });
        if (!role) throw notFound("Role");
        if (roleKey === "SUPER_ADMIN") throw badRequest("The Super Admin role always keeps every permission");
        const perms = await db.permission.findMany({ where: { key: { in: d.permissions } } });
        await db.$transaction([
            db.rolePermission.deleteMany({ where: { roleId: role.id } }),
            db.rolePermission.createMany({ data: perms.map((x) => ({ roleId: role.id, permissionId: x.id })) }),
        ]);
        invalidatePermissionCache();
        await audit(p, "ROLE_PERMISSIONS_CHANGED", "Role", role.id, { count: perms.length });
    },
    async auditLogs(p: Principal, q: { q?: string; page: number; size: number }) {
        await assertCan(p, "audit:read");
        const where: Prisma.AuditLogWhereInput = q.q
            ? {
                  OR: [
                      { action: { contains: q.q } },
                      { entity: { contains: q.q } },
                      { user: { email: { contains: q.q } } },
                  ],
              }
            : {};
        const [items, total] = await Promise.all([
            db.auditLog.findMany({
                where,
                include: { user: { select: { email: true } } },
                orderBy: { createdAt: "desc" },
                skip: q.page * q.size,
                take: q.size,
            }),
            db.auditLog.count({ where }),
        ]);
        return { items: items.map((i) => ({ ...i, id: String(i.id) })), total };
    },
    /** Non-secret system configuration (read-only: values come from environment variables). */
    async systemConfig(p: Principal) {
        await assertCan(p, "role:manage");
        const { env, oauthGoogleEnabled } = await import("@/lib/configuration/env");
        const [users, hospitals, patients, doctors, logs] = await Promise.all([
            db.user.count({ where: { deletedAt: null } }),
            db.hospital.count({ where: { deletedAt: null } }),
            db.patient.count({ where: { deletedAt: null } }),
            db.doctor.count({ where: { deletedAt: null } }),
            db.auditLog.count(),
        ]);
        return {
            settings: {
                "Application URL": env.appUrl,
                "Access token TTL (s)": env.accessTtl,
                "Refresh token TTL (days)": env.refreshTtlDays,
                "Secure cookies": env.cookieSecure,
                "Google OAuth": oauthGoogleEnabled() ? "configured" : "not configured",
                "E-mail": env.smtp.host ? `SMTP ${env.smtp.host}` : "console (SMTP not configured)",
                "Payment provider": env.paymentProvider,
                "Invoice tax rate (%)": env.taxRate,
                "Upload limit (MB)": env.maxUploadBytes / 1048576,
            },
            counts: { users, hospitals, patients, doctors, auditLogs: logs },
        };
    },
    /** Cross-hospital / hospital reports (aggregations). */
    async report(p: Principal) {
        await assertCan(p, "report:read");
        const hid = p.role !== "SUPER_ADMIN" && p.hospitalId ? { hospitalId: p.hospitalId } : {};
        const since = new Date(Date.now() - 30 * 86400_000);
        const [status, topDoctors, perDay] = await Promise.all([
            db.appointment.groupBy({
                by: ["status"],
                where: { ...hid, startsAt: { gte: since } },
                _count: { _all: true },
            }),
            db.appointment.groupBy({
                by: ["doctorId"],
                where: { ...hid, status: { in: ["COMPLETED", "CONFIRMED"] } },
                _count: { _all: true },
                orderBy: { _count: { doctorId: "desc" } },
                take: 5,
            }),
            db.$queryRaw<
                { d: string; n: bigint }[]
            >`SELECT DATE_FORMAT(startsAt, '%Y-%m-%d') AS d, COUNT(*) AS n FROM Appointment WHERE startsAt >= ${since} ${hid.hospitalId ? Prisma.sql`AND hospitalId = ${hid.hospitalId}` : Prisma.empty} GROUP BY d ORDER BY d`,
        ]);
        const docs = await db.doctor.findMany({
            where: { id: { in: topDoctors.map((t) => t.doctorId) } },
            include: { user: { select: { firstName: true, lastName: true } } },
        });
        return {
            byStatus: status.map((s) => ({ status: s.status, count: s._count._all })),
            topDoctors: topDoctors.map((t) => ({
                name: (() => {
                    const d = docs.find((x) => x.id === t.doctorId);
                    return d ? `Dr. ${d.user.firstName} ${d.user.lastName}` : `#${t.doctorId}`;
                })(),
                count: t._count._all,
            })),
            perDay: perDay.map((r) => ({ date: r.d, count: Number(r.n) })),
        };
    },
};

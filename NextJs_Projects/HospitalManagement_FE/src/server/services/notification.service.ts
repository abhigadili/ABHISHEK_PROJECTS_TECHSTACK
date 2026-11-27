import "server-only";
import { db } from "@/server/db";
import { sendMail } from "./mail";
import { env } from "@/lib/configuration/env";
import type { Principal } from "@/server/authorization/principal";
import { notFound } from "@/server/utilities/errors";

export interface NotifyInput {
    type: string;
    title: string;
    message: string;
    link?: string;
    important?: boolean;
}

/** Create in-app notification(s) and (per user preference) send an e-mail. E-mail failures never break the business operation. */
export async function notify(userIds: number | number[], n: NotifyInput): Promise<void> {
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
    const users = await db.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, email: true, notificationPref: true },
    });
    for (const u of users) {
        const pref = u.notificationPref ?? { inApp: true, email: true, reminders: true };
        if (n.type === "APPOINTMENT_REMINDER" && !pref.reminders) continue;
        if (pref.inApp || n.important) {
            const row = await db.notification.create({
                data: { userId: u.id, type: n.type, title: n.title, message: n.message, link: n.link },
            });
            if (pref.email)
                void sendMail(u.email, n.title, `${n.message}\n\n${n.link ? env.appUrl + n.link : ""}`)
                    .then(async (sent) => {
                        if (sent) await db.notification.update({ where: { id: row.id }, data: { emailSent: true } });
                    })
                    .catch((e) => console.error("[notify:mail]", e));
        }
    }
}

export const notificationService = {
    async list(p: Principal, q: { unread?: boolean; page: number; size: number }) {
        const where = { userId: p.userId, ...(q.unread ? { readAt: null } : {}) };
        const [items, total, unread] = await Promise.all([
            db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: q.page * q.size, take: q.size }),
            db.notification.count({ where }),
            db.notification.count({ where: { userId: p.userId, readAt: null } }),
        ]);
        return { items, total, unread };
    },
    async unreadCount(p: Principal) {
        return db.notification.count({ where: { userId: p.userId, readAt: null } });
    },
    async markRead(p: Principal, id: number) {
        const r = await db.notification.updateMany({
            where: { id, userId: p.userId, readAt: null },
            data: { readAt: new Date() },
        });
        if (!r.count && !(await db.notification.count({ where: { id, userId: p.userId } })))
            throw notFound("Notification");
    },
    async markAllRead(p: Principal) {
        await db.notification.updateMany({ where: { userId: p.userId, readAt: null }, data: { readAt: new Date() } });
    },
    async getPreferences(p: Principal) {
        return (
            (await db.notificationPreference.findUnique({ where: { userId: p.userId } })) ?? {
                userId: p.userId,
                inApp: true,
                email: true,
                reminders: true,
            }
        );
    },
    async setPreferences(p: Principal, d: { inApp: boolean; email: boolean; reminders: boolean }) {
        return db.notificationPreference.upsert({
            where: { userId: p.userId },
            create: { userId: p.userId, ...d },
            update: d,
        });
    },
};

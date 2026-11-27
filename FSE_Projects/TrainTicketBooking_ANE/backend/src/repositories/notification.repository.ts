import { prisma } from '../database/prisma';
export const notificationRepo = {
  create: (data: { userId: number; type: string; title: string; message: string; link?: string }) => prisma.notification.create({ data }),
  markEmailSent: (id: number) => prisma.notification.update({ where: { id }, data: { emailSent: true } }),
  list: (userId: number, unread: boolean, skip: number, take: number) => Promise.all([
    prisma.notification.findMany({ where: { userId, ...(unread ? { readAt: null } : {}) }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where: { userId, ...(unread ? { readAt: null } : {}) } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]),
  markRead: (userId: number, id: number) => prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } }),
  exists: (userId: number, id: number) => prisma.notification.count({ where: { id, userId } }),
  markAllRead: (userId: number) => prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }),
  prefs: (userId: number) => prisma.notificationPreference.findUnique({ where: { userId } }),
  setPrefs: (userId: number, d: { inApp: boolean; email: boolean }) => prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...d }, update: d }),
  users: (ids: number[]) => prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, email: true, preferences: true } }),
};

import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { hashPassword, verifyPassword, DUMMY_HASH } from "@/server/auth/password";
import {
    clearAuthCookies,
    revokeAllSessions,
    revokeSession,
    rotateSession,
    startSession,
    getPrincipal,
} from "@/server/auth/session";
import { signMfaChallenge, verifyMfaChallenge } from "@/server/auth/tokens";
import { mfaService } from "@/server/auth/mfa";
import { randomToken, sha256 } from "@/server/utilities/crypto";
import { badRequest, tooMany, unauthorized } from "@/server/utilities/errors";
import { nextMrn } from "@/server/utilities/ids";
import { audit } from "./audit.service";
import { notify } from "./notification.service";
import { sendMail } from "./mail";
import { env } from "@/lib/configuration/env";
import { MFA_COOKIE, RT_COOKIE } from "@/lib/constants/auth";
import { ROLE_HOME, type RoleKey } from "@/lib/constants/rbac";
import { emptyToUndef } from "@/lib/validations/common";
import type { RegisterPatientInput } from "@/lib/validations/auth";

const MAX_FAILS = 5,
    LOCK_MIN = 15;
export type LoginResult = { status: "ok"; home: string } | { status: "mfa" };

export const authService = {
    /** Scenario 1: creates User + Patient + preferences in ONE transaction, assigns the PATIENT role, starts a session. */
    async registerPatient(d: RegisterPatientInput): Promise<{ home: string }> {
        const role = await db.role.findUniqueOrThrow({ where: { key: "PATIENT" } });
        if (await db.user.findUnique({ where: { email: d.account.email } }))
            throw badRequest("This e-mail is already registered", { "account.email": "Already registered" });
        const passwordHash = await hashPassword(d.account.password);
        const user = await db.$transaction(async (tx) => {
            const u = await tx.user.create({
                data: {
                    email: d.account.email,
                    passwordHash,
                    firstName: d.personal.firstName,
                    lastName: d.personal.lastName,
                    phone: d.personal.phone,
                    roleId: role.id,
                },
            });
            await tx.patient.create({
                data: {
                    userId: u.id,
                    mrn: await nextMrn(tx),
                    dateOfBirth: new Date(d.personal.dateOfBirth),
                    gender: d.personal.gender,
                    bloodGroup: emptyToUndef(d.personal.bloodGroup),
                    address: emptyToUndef(d.personal.address),
                    city: emptyToUndef(d.personal.city),
                    emergencyContactName: emptyToUndef(d.emergency.name),
                    emergencyContactPhone: emptyToUndef(d.emergency.phone),
                },
            });
            await tx.notificationPreference.create({ data: { userId: u.id } });
            return u;
        });
        await startSession(user.id);
        await audit({ userId: user.id }, "REGISTER", "User", user.id);
        await notify(user.id, {
            type: "WELCOME",
            title: "Welcome to " + env.appName,
            message: "Your patient account is ready. You can now book appointments.",
            link: "/patient",
        });
        return { home: ROLE_HOME.PATIENT };
    },

    async login(email: string, password: string): Promise<LoginResult> {
        const u = await db.user.findUnique({ where: { email }, include: { role: true } });
        if (u?.lockedUntil && u.lockedUntil > new Date())
            throw tooMany("Account temporarily locked after too many failed attempts");
        const ok = u?.passwordHash
            ? await verifyPassword(password, u.passwordHash)
            : (await verifyPassword(password, DUMMY_HASH), false);
        if (!u || !ok || u.deletedAt) {
            if (u) {
                const fails = u.failedLogins + 1;
                await db.user.update({
                    where: { id: u.id },
                    data: {
                        failedLogins: fails,
                        lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null,
                    },
                });
                await audit({ userId: u.id }, "LOGIN_FAILED", "User", u.id);
            }
            throw unauthorized("Invalid e-mail or password");
        }
        if (u.status !== "ACTIVE")
            throw unauthorized(
                u.status === "SUSPENDED" ? "This account has been suspended" : "This account is not active yet",
            );
        if (await mfaService.isEnabled(u.id)) {
            (await cookies()).set(MFA_COOKIE, await signMfaChallenge(u.id), {
                httpOnly: true,
                sameSite: "lax",
                secure: env.cookieSecure,
                path: "/",
                maxAge: 300,
            });
            return { status: "mfa" };
        }
        await startSession(u.id);
        await audit({ userId: u.id }, "LOGIN", "User", u.id);
        return { status: "ok", home: ROLE_HOME[u.role.key as RoleKey] };
    },

    /** Second login step: TOTP code or recovery code. */
    async completeMfa(code: string): Promise<{ home: string }> {
        const userId = await verifyMfaChallenge((await cookies()).get(MFA_COOKIE)?.value ?? "");
        if (!userId) throw unauthorized("Your sign-in attempt expired - start again");
        if (!(await mfaService.verify(userId, code))) {
            await audit({ userId }, "MFA_FAILED", "User", userId);
            throw badRequest("That code is not valid", { code: "Invalid code" });
        }
        const u = await startSession(userId);
        await audit({ userId }, "LOGIN_MFA", "User", userId);
        return { home: ROLE_HOME[u.role.key as RoleKey] };
    },

    async logout() {
        const p = await getPrincipal();
        await revokeSession((await cookies()).get(RT_COOKIE)?.value);
        if (p) await audit(p, "LOGOUT", "User", p.userId);
    },
    async refresh(): Promise<void> {
        const raw = (await cookies()).get(RT_COOKIE)?.value;
        if (!raw) throw unauthorized("No refresh token");
        try {
            await rotateSession(raw);
        } catch (e) {
            await clearAuthCookies();
            throw e;
        }
    },

    /** Always answers the same way (no account enumeration). The link is e-mailed (console in demo mode). */
    async forgotPassword(email: string) {
        const u = await db.user.findUnique({ where: { email } });
        if (!u || u.deletedAt || u.status !== "ACTIVE") return;
        const raw = randomToken(32);
        await db.passwordResetToken.create({
            data: { userId: u.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3600_000) },
        });
        await sendMail(
            u.email,
            "Reset your password",
            `Use this link within one hour to choose a new password:\n${env.appUrl}/reset-password?token=${raw}`,
        );
        await audit({ userId: u.id }, "PASSWORD_RESET_REQUESTED", "User", u.id);
    },
    async resetPassword(token: string, password: string) {
        const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
        if (!row || row.usedAt || row.expiresAt < new Date())
            throw badRequest("This reset link is invalid or has expired");
        await db.$transaction([
            db.user.update({
                where: { id: row.userId },
                data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
            }),
            db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
        ]);
        await revokeAllSessions(row.userId);
        await audit({ userId: row.userId }, "PASSWORD_RESET", "User", row.userId);
    },
    async changePassword(userId: number, current: string, next: string) {
        const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
        if (!u.passwordHash || !(await verifyPassword(current, u.passwordHash)))
            throw badRequest("Current password is incorrect", { currentPassword: "Incorrect password" });
        await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
        await revokeAllSessions(userId, (await cookies()).get(RT_COOKIE)?.value);
        await audit({ userId }, "PASSWORD_CHANGED", "User", userId);
    },
};

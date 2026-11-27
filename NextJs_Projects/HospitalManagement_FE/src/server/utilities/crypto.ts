import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/configuration/env";

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const randomCode = (len = 10) =>
    Array.from(randomBytes(len), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
export const safeEqual = (a: string, b: string) => {
    const x = Buffer.from(a),
        y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
};

/** AES-256-GCM for secrets stored in MySQL (TOTP seeds). Format: iv.tag.ciphertext (base64url). */
export function encryptSecret(plain: string): string {
    const key = Buffer.from(env.mfaKey, "base64");
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function decryptSecret(token: string): string {
    const [iv, tag, enc] = token.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", Buffer.from(env.mfaKey, "base64"), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

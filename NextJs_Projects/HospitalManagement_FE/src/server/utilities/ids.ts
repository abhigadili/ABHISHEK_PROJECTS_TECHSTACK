import "server-only";
import type { Tx } from "@/server/db";
import { randomCode } from "./crypto";

/** Human readable identifiers (unique constraints in MySQL are the real guarantee; the random part makes collisions negligible). */
export async function nextMrn(tx: Pick<Tx, "patient">): Promise<string> {
    for (let i = 0; i < 5; i++) {
        const m = `MRN${new Date().getFullYear() % 100}${randomCode(6)}`;
        if (!(await tx.patient.findUnique({ where: { mrn: m } }))) return m;
    }
    throw new Error("Could not allocate an MRN");
}
export const invoiceNumber = () => `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomCode(5)}`;
export const confirmationCode = () => randomCode(8);
export const paymentReference = () => `PAY-${randomCode(12)}`;

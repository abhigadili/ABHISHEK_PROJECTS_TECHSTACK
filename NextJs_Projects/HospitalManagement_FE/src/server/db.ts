import "server-only";
import { PrismaClient } from "@prisma/client";

/** Single PrismaClient per server process (connection pool lives inside it). Reused across hot reloads in dev. */
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db =
    g.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (process.env.NODE_ENV !== "production") g.prisma = db;
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

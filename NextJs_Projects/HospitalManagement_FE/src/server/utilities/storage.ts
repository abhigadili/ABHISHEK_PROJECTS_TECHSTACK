import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/configuration/env";
import { badRequest } from "./errors";

const ALLOWED = new Map([
    ["application/pdf", "pdf"],
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
]);
const dir = () => path.resolve(env.uploadDir);

/** File upload validation (type allow-list, size, magic bytes) + storage OUTSIDE /public under a random name. Files are served only through authorised handlers. */
export async function saveUpload(
    file: File,
): Promise<{ fileName: string; storedName: string; mimeType: string; sizeBytes: number }> {
    const ext = ALLOWED.get(file.type);
    if (!ext) throw badRequest("Only PDF, PNG or JPEG files are accepted", { file: "Unsupported file type" });
    if (file.size > env.maxUploadBytes)
        throw badRequest(`File exceeds ${env.maxUploadBytes / 1024 / 1024} MB`, { file: "File too large" });
    const buf = Buffer.from(await file.arrayBuffer());
    const head = buf.subarray(0, 4).toString("latin1");
    const okMagic =
        (ext === "pdf" && head.startsWith("%PDF")) ||
        (ext === "png" && buf[0] === 0x89 && head.slice(1, 4) === "PNG") ||
        (ext === "jpg" && buf[0] === 0xff && buf[1] === 0xd8);
    if (!okMagic) throw badRequest("The file content does not match its type", { file: "Corrupt or mislabelled file" });
    await mkdir(dir(), { recursive: true });
    const storedName = `${randomBytes(16).toString("hex")}.${ext}`;
    await writeFile(path.join(dir(), storedName), buf);
    return {
        fileName: file.name.replace(/[^\w.\- ]/g, "_").slice(0, 190),
        storedName,
        mimeType: file.type,
        sizeBytes: file.size,
    };
}
export const readUpload = (storedName: string) => readFile(path.join(dir(), path.basename(storedName)));

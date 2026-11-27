import "server-only";
import { db } from "@/server/db";
import { assertCan } from "@/server/authorization/rbac";
import { assertClinicalAccess, doctorTreatsPatient, assertHospitalScope } from "@/server/authorization/access";
import { badRequest, forbidden, notFound } from "@/server/utilities/errors";
import { readUpload, saveUpload } from "@/server/utilities/storage";
import { labReportSchema, labRequestSchema, labStatusSchema, labTestSchema } from "@/lib/validations/clinical";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import type { Principal } from "@/server/authorization/principal";
import type { Prisma } from "@prisma/client";

const include = {
    test: { include: { category: true } },
    patient: { include: { user: { select: { firstName: true, lastName: true } } } },
    doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    report: true,
} satisfies Prisma.LabRequestInclude;
const scope = (p: Principal): Prisma.LabRequestWhereInput =>
    p.role === "PATIENT"
        ? { patientId: p.patientId ?? -1, report: { published: true } }
        : p.role === "DOCTOR"
          ? { doctorId: p.doctorId ?? -1 }
          : p.role !== "SUPER_ADMIN" && p.hospitalId
            ? { hospitalId: p.hospitalId }
            : {};

export const labService = {
    categories: () => db.labTestCategory.findMany({ orderBy: { name: "asc" } }),
    async catalog(p: Principal, q: { q?: string; categoryId?: number }) {
        await assertCan(p, "lab:read");
        return db.laboratoryTest.findMany({
            where: {
                active: true,
                ...(q.categoryId ? { categoryId: q.categoryId } : {}),
                ...(q.q ? { OR: [{ name: { contains: q.q } }, { code: { contains: q.q } }] } : {}),
            },
            include: { category: true },
            orderBy: { name: "asc" },
        });
    },
    async createTest(p: Principal, raw: unknown) {
        await assertCan(p, "lab:catalog");
        const d = labTestSchema.parse(raw);
        const t = await db.laboratoryTest.create({ data: { ...d, sampleType: d.sampleType || null } });
        await audit(p, "LABTEST_CREATED", "LaboratoryTest", t.id);
        return t;
    },

    /** Scenario 4 steps 1-4: a doctor requests one or more tests for a patient they treat (one request row per test). */
    async request(p: Principal, raw: unknown) {
        await assertCan(p, "lab:request");
        if (!p.doctorId) throw forbidden("Only doctors can request tests");
        const d = labRequestSchema.parse(raw);
        if (!(await doctorTreatsPatient(p.doctorId, d.patientId)))
            throw forbidden("This patient is not under your care");
        if (d.appointmentId) {
            const a = await db.appointment.findUnique({ where: { id: d.appointmentId } });
            if (!a || a.doctorId !== p.doctorId || a.patientId !== d.patientId)
                throw badRequest("Appointment mismatch");
        }
        // Link the request to the doctor's most recent non-cancelled appointment with this patient so the tests are billed on that visit's invoice.
        if (!d.appointmentId)
            d.appointmentId = (
                await db.appointment.findFirst({
                    where: { doctorId: p.doctorId, patientId: d.patientId, status: { not: "CANCELLED" } },
                    orderBy: { startsAt: "desc" },
                    select: { id: true },
                })
            )?.id;
        const tests = await db.laboratoryTest.findMany({ where: { id: { in: d.testIds }, active: true } });
        if (tests.length !== new Set(d.testIds).size) throw badRequest("One or more tests are unavailable");
        const rows = await db.$transaction(
            tests.map((t) =>
                db.labRequest.create({
                    data: {
                        patientId: d.patientId,
                        doctorId: p.doctorId!,
                        appointmentId: d.appointmentId ?? null,
                        testId: t.id,
                        hospitalId: d.hospitalId,
                        priority: d.priority,
                        clinicalNotes: d.clinicalNotes || null,
                    },
                }),
            ),
        );
        const staff = await db.user.findMany({
            where: { hospitalId: d.hospitalId, role: { key: "LAB_STAFF" }, status: "ACTIVE" },
            select: { id: true },
        });
        await notify(
            staff.map((s) => s.id),
            {
                type: "LAB_REQUESTED",
                title: "New laboratory request",
                message: `${rows.length} test(s) requested (${d.priority}).`,
                link: "/lab/requests",
            },
        );
        await audit(p, "LAB_REQUESTED", "LabRequest", rows[0].id);
        return rows;
    },
    async list(p: Principal, q: { status?: string; patientId?: number; page: number; size: number }) {
        await assertCan(p, "lab:read");
        const where: Prisma.LabRequestWhereInput = {
            ...scope(p),
            ...(q.status ? { status: q.status as never } : {}),
            ...(q.patientId && p.role !== "PATIENT" ? { patientId: q.patientId } : {}),
        };
        const [items, total] = await Promise.all([
            db.labRequest.findMany({
                where,
                include,
                orderBy: [{ requestedAt: "desc" }],
                skip: q.page * q.size,
                take: q.size,
            }),
            db.labRequest.count({ where }),
        ]);
        return { items, total };
    },
    async get(p: Principal, id: number) {
        await assertCan(p, "lab:read");
        const r = await db.labRequest.findUnique({ where: { id }, include });
        if (!r) throw notFound("Request");
        if (p.role === "PATIENT") {
            if (r.patientId !== p.patientId || !r.report?.published) throw forbidden();
        } else if (p.role === "DOCTOR") {
            if (r.doctorId !== p.doctorId) throw forbidden();
        } else assertHospitalScope(p, r.hospitalId);
        return r;
    },
    /** Steps 5-7: staff collect the sample / start processing / schedule. */
    async setStatus(p: Principal, id: number, raw: unknown) {
        await assertCan(p, "lab:process");
        const r = await this.get(p, id);
        const d = labStatusSchema.parse(raw);
        const order = ["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "COMPLETED"];
        if (r.status === "COMPLETED" || r.status === "CANCELLED") throw badRequest("This request is closed");
        if (d.status !== "CANCELLED" && order.indexOf(d.status) !== order.indexOf(r.status) + 1)
            throw badRequest(`Cannot move from ${r.status} to ${d.status}`);
        await db.labRequest.update({
            where: { id },
            data: {
                status: d.status,
                ...(d.status === "SAMPLE_COLLECTED" ? { sampleCollectedAt: new Date() } : {}),
                ...(d.scheduledAt ? { scheduledAt: new Date(d.scheduledAt) } : {}),
            },
        });
        await audit(p, "LAB_" + d.status, "LabRequest", id);
    },
    async schedule(p: Principal, id: number, at: string) {
        await assertCan(p, "lab:process");
        await this.get(p, id);
        await db.labRequest.update({ where: { id }, data: { scheduledAt: new Date(at) } });
    },
    /** Steps 8-10: enter results, optional report file, publish, notify doctor + patient. */
    async enterReport(p: Principal, id: number, raw: unknown, file?: File | null) {
        await assertCan(p, "lab:process");
        const r = await this.get(p, id);
        const d = labReportSchema.parse(raw);
        if (r.status !== "PROCESSING" && r.status !== "COMPLETED")
            throw badRequest("Start processing before entering results");
        const f = file && file.size ? await saveUpload(file) : null;
        await db.$transaction([
            db.labReport.upsert({
                where: { requestId: id },
                create: {
                    requestId: id,
                    enteredById: p.userId,
                    resultSummary: d.resultSummary,
                    resultDetails: d.resultDetails || null,
                    referenceRange: d.referenceRange || null,
                    abnormal: d.abnormal,
                    published: d.publish,
                    publishedAt: d.publish ? new Date() : null,
                    ...(f ? { fileName: f.fileName, storedName: f.storedName } : {}),
                },
                update: {
                    resultSummary: d.resultSummary,
                    resultDetails: d.resultDetails || null,
                    referenceRange: d.referenceRange || null,
                    abnormal: d.abnormal,
                    published: d.publish,
                    publishedAt: d.publish ? new Date() : null,
                    ...(f ? { fileName: f.fileName, storedName: f.storedName } : {}),
                },
            }),
            db.labRequest.update({ where: { id }, data: { status: "COMPLETED" } }),
        ]);
        if (d.publish) {
            const full = await db.labRequest.findUniqueOrThrow({
                where: { id },
                include: { patient: true, doctor: true, test: true },
            });
            await notify([full.patient.userId, full.doctor.userId], {
                type: "LAB_REPORT_PUBLISHED",
                title: "Laboratory report ready",
                message: `${full.test.name}: report published${d.abnormal ? " (abnormal result)" : ""}.`,
                link: `/patient/lab/${id}`,
                important: true,
            });
        }
        await audit(p, "LAB_REPORT_ENTERED", "LabRequest", id);
    },
    async downloadReport(p: Principal, id: number) {
        const r = await this.get(p, id);
        await assertClinicalAccessIfNeeded(p, r.patientId);
        if (!r.report?.storedName) throw notFound("Report file");
        await audit(p, "LAB_REPORT_DOWNLOADED", "LabRequest", id);
        return {
            name: r.report.fileName ?? "report",
            data: await readUpload(r.report.storedName),
            type: r.report.storedName.endsWith("pdf")
                ? "application/pdf"
                : r.report.storedName.endsWith("png")
                  ? "image/png"
                  : "image/jpeg",
        };
    },
    async dashboard(p: Principal) {
        await assertCan(p, "lab:read");
        const where = scope(p);
        const g = await db.labRequest.groupBy({ by: ["status"], where, _count: { _all: true } });
        const c = (s: string) => g.find((x) => x.status === s)?._count._all ?? 0;
        return {
            requested: c("REQUESTED"),
            collected: c("SAMPLE_COLLECTED"),
            processing: c("PROCESSING"),
            completed: c("COMPLETED"),
            published: await db.labReport.count({ where: { published: true, request: where } }),
        };
    },
};
async function assertClinicalAccessIfNeeded(p: Principal, patientId: number) {
    if (p.role === "LAB_STAFF") return;
    await assertClinicalAccess(p, patientId);
}

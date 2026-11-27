import "server-only";
import { unstable_cache } from "next/cache";
import { hospitalService } from "@/server/services/hospital.service";
import { doctorService } from "@/server/services/doctor.service";
import { db } from "@/server/db";
import { TAGS } from "@/lib/constants/cache";

/**
 * PUBLIC data cache (shared between all visitors): hospital & doctor directory facts only.
 * Time-based revalidation (`revalidate`) + tags for on-demand invalidation (revalidateTag in the Server Actions that edit them).
 * Private data (patients, records, prescriptions, invoices, notifications ...) is NEVER read through these helpers.
 */
export const getPublicHospitals = unstable_cache(
    async () => (await hospitalService.listPublic()).items,
    ["public-hospitals"],
    { revalidate: 300, tags: [TAGS.hospitals] },
);
export const getPublicHospital = unstable_cache(
    async (slug: string) => hospitalService.getPublicBySlug(slug),
    ["public-hospital"],
    { revalidate: 300, tags: [TAGS.hospitals, TAGS.departments] },
);
export const getPublicDoctors = unstable_cache(
    async (specializationId?: number) => doctorService.listPublic({ specializationId }),
    ["public-doctors"],
    { revalidate: 300, tags: [TAGS.doctors] },
);
export const getPublicDoctor = unstable_cache(async (id: number) => doctorService.getPublic(id), ["public-doctor"], {
    revalidate: 300,
    tags: [TAGS.doctors],
});
export const getSpecializations = unstable_cache(async () => doctorService.specializations(), ["specializations"], {
    revalidate: 3600,
    tags: [TAGS.doctors],
});
export const getPublicDepartments = unstable_cache(
    async () =>
        db.department.findMany({
            where: { active: true, hospital: { active: true, deletedAt: null } },
            include: { hospital: { select: { name: true, slug: true } } },
            orderBy: { name: "asc" },
        }),
    ["public-departments"],
    { revalidate: 300, tags: [TAGS.departments, TAGS.hospitals] },
);

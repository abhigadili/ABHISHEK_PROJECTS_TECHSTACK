'use server';
import { revalidatePath, revalidateTag, updateTag } from 'next/cache';
import { requireUser } from '@/lib/server/session';
import { TAGS } from '@/lib/constants';

/**
 * Server Function called by the admin screens right after a successful Express mutation.
 * It purges the public, cached catalogue pages (stations / trains / one train) so visitors see the change immediately.
 * `updateTag` = read-your-own-writes (expire now); `revalidateTag(..., 'max')` = stale-while-revalidate for the broader list.
 */
export async function revalidateCatalogAction(scope: 'stations' | 'trains', trainId?: number) {
  await requireUser(['ADMIN', 'TRAIN_OPERATOR']);
  if (scope === 'stations') { updateTag(TAGS.stations); revalidatePath('/stations'); revalidatePath('/'); }
  else { updateTag(TAGS.trains); if (trainId) updateTag(TAGS.train(trainId)); revalidateTag(TAGS.stations, 'max'); revalidatePath('/trains'); }
}

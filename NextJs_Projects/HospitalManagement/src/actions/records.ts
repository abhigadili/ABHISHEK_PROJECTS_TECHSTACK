'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { recordsService } from '@/services/backend/records';
import { authorize, failure, invalid, str, success, type ActionState } from '@/lib/actions/state';
import { CACHE_TAGS } from '@/constants/cache';
import { RECORD_ENTRY_TYPES } from '@/types';

export async function createRecordEntryAction(patientId: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('records:write');
  if ('denied' in auth) return auth.denied;
  const parsed = z.object({ entryType: z.enum(RECORD_ENTRY_TYPES as unknown as [string, ...string[]], { message: 'Choose an entry type' }), title: z.string().trim().min(1, 'Title is required').max(200), details: z.string().trim().max(4000) }).safeParse({ entryType: str(fd, 'entryType'), title: str(fd, 'title'), details: str(fd, 'details') });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await recordsService.create({ patientId, entryType: parsed.data.entryType as (typeof RECORD_ENTRY_TYPES)[number], title: parsed.data.title, details: parsed.data.details || null });
    updateTag(CACHE_TAGS.records); revalidatePath(`/patients/${patientId}/medical-records`);
    return success('Record entry added');
  } catch (e) { return failure(e); }
}

export async function saveConditionsAction(patientId: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('records:write');
  if ('denied' in auth) return auth.denied;
  const text = str(fd, 'chronicConditions').trim();
  if (text.length > 1000) return { ok: false, message: 'Too long', fieldErrors: { chronicConditions: 'At most 1000 characters' } };
  try { await recordsService.setConditions(patientId, text); updateTag(CACHE_TAGS.records); revalidatePath(`/patients/${patientId}/medical-records`); return success('Chronic conditions saved'); } catch (e) { return failure(e); }
}

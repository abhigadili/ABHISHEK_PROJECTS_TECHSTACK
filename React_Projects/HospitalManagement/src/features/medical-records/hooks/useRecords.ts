import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordsApi } from '@/services/endpoints/recordsApi';
import { laboratoryApi } from '@/services/endpoints/laboratoryApi';
import { queryKeys } from '@/services/queryKeys';
import type { RecordEntry, RecordEntryInput, RecordEntryType } from '@/types';

/** Entire timeline up to 100 entries (Fetch API). The timeline component virtualises the rows. */
export function useRecordEntries(patientId: number, type?: RecordEntryType) {
  return useQuery({
    queryKey: queryKeys.records.entries(patientId, type),
    queryFn: ({ signal }) => recordsApi.entries(patientId, { type, page: 0, size: 100 }, signal),
    enabled: patientId > 0,
    meta: { errorMessage: 'Could not load medical records' },
  });
}

export function useRecordSummary(patientId: number) {
  return useQuery({ queryKey: queryKeys.records.summary(patientId), queryFn: ({ signal }) => recordsApi.summary(patientId, signal), enabled: patientId > 0 });
}

export function useRecordEntry(id: number) {
  const qc = useQueryClient();
  return useQuery<RecordEntry>({
    queryKey: queryKeys.records.entry(id),
    queryFn: ({ signal }) => recordsApi.entry(id, signal),
    enabled: id > 0,
    initialData: () => {
      for (const [, page] of qc.getQueriesData<{ content: RecordEntry[] }>({ queryKey: [...queryKeys.records.all, 'entries'] })) {
        const hit = page?.content?.find((e) => e.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => qc.getQueryState([...queryKeys.records.all, 'entries'])?.dataUpdatedAt,
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: RecordEntryInput) => recordsApi.createEntry(b),
    meta: { silent: true },
    onSuccess: (e) => {
      void qc.invalidateQueries({ queryKey: [...queryKeys.records.all, 'entries', e.patientId] });
      void qc.invalidateQueries({ queryKey: queryKeys.records.summary(e.patientId) });
    },
  });
}

export function useUpdateEntry(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { title: string; details?: string | null }) => recordsApi.updateEntry(id, b),
    meta: { silent: true },
    onSuccess: (e) => {
      qc.setQueryData(queryKeys.records.entry(id), e);
      void qc.invalidateQueries({ queryKey: [...queryKeys.records.all, 'entries', e.patientId] });
      void qc.invalidateQueries({ queryKey: queryKeys.records.summary(e.patientId) });
    },
  });
}

export function useSetConditions(patientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: string | null) => recordsApi.setConditions(patientId, c),
    meta: { successMessage: 'Chronic conditions saved', errorMessage: 'Could not save conditions' },
    onSuccess: (s) => qc.setQueryData(queryKeys.records.summary(patientId), s),
  });
}

/** Lab requests of a patient + whether they have a report attachment: used by the Medical Documents page. */
export function useDocumentCandidates(patientId: number) {
  return useQuery({ queryKey: queryKeys.laboratory.forPatient(patientId), queryFn: ({ signal }) => laboratoryApi.requestsForPatient(patientId, signal), enabled: patientId > 0 });
}

export function useLabReportFetch(requestId: number, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.laboratory.report(requestId), queryFn: ({ signal }) => recordsApi.labReport(requestId, signal), enabled, retry: false, meta: { silent: true } });
}

export function useUploadDocument(requestId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => recordsApi.uploadDocument(requestId, file),
    meta: { successMessage: 'Document uploaded', errorMessage: 'Upload failed' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.laboratory.report(requestId) }),
  });
}

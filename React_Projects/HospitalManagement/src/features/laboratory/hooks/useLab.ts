import { keepPreviousData, useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoryApi } from '@/services/endpoints/laboratoryApi';
import { queryKeys } from '@/services/queryKeys';
import type { LabReportInput, LabRequest, LabRequestInput, LabStatus, LabTestInput, Page } from '@/types';

export function useLabTests() {
  return useQuery({ queryKey: queryKeys.laboratory.tests(), queryFn: ({ signal }) => laboratoryApi.tests(signal), meta: { errorMessage: 'Could not load the test catalogue' } });
}

/** Server-side pagination (page numbers). `keepPreviousData` avoids a flash of skeletons between pages. */
export function useLabRequestPage(status: LabStatus | undefined, page: number, size = 10, enabled = true) {
  return useQuery({
    queryKey: queryKeys.laboratory.requests({ status, page, size }),
    queryFn: ({ signal }) => laboratoryApi.requests({ status, page, size }, signal),
    placeholderData: keepPreviousData,
    enabled,
    meta: { errorMessage: 'Could not load lab requests' },
  });
}

/** Infinite query: "Load more" / auto-load as the list is scrolled. Pages are fetched sequentially. */
export function useLabRequestsInfinite(status?: LabStatus, size = 10, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.laboratory.requestsInfinite(status),
    queryFn: ({ pageParam, signal }) => laboratoryApi.requests({ status, page: pageParam, size }, signal),
    initialPageParam: 0,
    getNextPageParam: (last: Page<LabRequest>) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled,
    meta: { errorMessage: 'Could not load lab requests' },
  });
}

export function usePatientLab(patientId: number) {
  return useQuery({ queryKey: queryKeys.laboratory.forPatient(patientId), queryFn: ({ signal }) => laboratoryApi.requestsForPatient(patientId, signal), enabled: patientId > 0, meta: { errorMessage: 'Could not load lab history' } });
}

export function useLabRequest(id: number) {
  const qc = useQueryClient();
  return useQuery<LabRequest>({
    queryKey: queryKeys.laboratory.request(id),
    queryFn: ({ signal }) => laboratoryApi.request(id, signal),
    enabled: id > 0,
    // a request that is not finished is polled: status/accession number are changed asynchronously (Kafka consumer)
    refetchInterval: (q) => (q.state.data && (q.state.data.status === 'COMPLETED' || q.state.data.status === 'CANCELLED') && q.state.data.accessionNumber ? false : 8000),
    initialData: () => {
      for (const [, v] of qc.getQueriesData<Page<LabRequest> | LabRequest[]>({ queryKey: queryKeys.laboratory.all })) {
        const list = Array.isArray(v) ? v : (v as Page<LabRequest> | undefined)?.content;
        const hit = list?.find?.((r) => r.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.laboratory.all)?.dataUpdatedAt,
  });
}

export function useLabReport(id: number, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.laboratory.report(id), queryFn: ({ signal }) => laboratoryApi.report(id, signal), enabled: enabled && id > 0, retry: false, meta: { silent: true } });
}

/** Many reports in parallel (dynamic useQueries) - used by the Lab Reports page for the rows currently loaded. */
export function useLabReports(ids: number[]) {
  return useQueries({ queries: ids.map((id) => ({ queryKey: queryKeys.laboratory.report(id), queryFn: ({ signal }: { signal: AbortSignal }) => laboratoryApi.report(id, signal), retry: false, staleTime: 60_000, meta: { silent: true } })) });
}

export function useCreateLabRequests() {
  const qc = useQueryClient();
  return useMutation({
    /** One POST per selected test, fired in parallel; every outcome is reported (Promise.allSettled). */
    mutationFn: async (reqs: LabRequestInput[]) => {
      const settled = await Promise.allSettled(reqs.map((r) => laboratoryApi.createRequest(r)));
      return settled.map((s, i) => ({ testCode: reqs[i]!.testCode, ok: s.status === 'fulfilled', request: s.status === 'fulfilled' ? s.value : undefined, error: s.status === 'rejected' ? (s.reason as Error).message : undefined }));
    },
    meta: { silent: true },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.laboratory.all });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.laboratory.all }), 2500); // accession number is assigned asynchronously
      setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.billing.all }), 2500); // lab bill
    },
  });
}

/** Optimistic status transition for the lab workflow. */
export function useSetLabStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: LabStatus }) => laboratoryApi.setStatus(id, status),
    meta: { errorMessage: 'Status change rejected' },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.laboratory.request(id) });
      const prev = qc.getQueryData<LabRequest>(queryKeys.laboratory.request(id));
      if (prev) qc.setQueryData<LabRequest>(queryKeys.laboratory.request(id), { ...prev, status });
      return { prev };
    },
    onError: (_e, { id }, ctx) => ctx?.prev && qc.setQueryData(queryKeys.laboratory.request(id), ctx.prev),
    onSettled: (_d, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.laboratory.request(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.laboratory.all });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useCancelLabRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => laboratoryApi.cancel(id),
    meta: { successMessage: 'Lab request cancelled', errorMessage: 'Could not cancel request' },
    onSuccess: (r) => { qc.setQueryData(queryKeys.laboratory.request(r.id), r); void qc.invalidateQueries({ queryKey: queryKeys.laboratory.all }); void qc.invalidateQueries({ queryKey: queryKeys.billing.all }); },
  });
}

export function useSubmitLabReport(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: LabReportInput) => laboratoryApi.submitReport(id, b),
    meta: { silent: true },
    onSuccess: (report) => {
      qc.setQueryData(queryKeys.laboratory.report(id), report);
      void qc.invalidateQueries({ queryKey: queryKeys.laboratory.request(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.laboratory.all });
      void qc.invalidateQueries({ queryKey: queryKeys.records.all }); // timeline gets a LAB_REPORT entry
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useCreateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: LabTestInput) => laboratoryApi.createTest(b),
    meta: { silent: true },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.laboratory.tests() }),
  });
}

export function useUploadAttachment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (p: number) => void }) => laboratoryApi.uploadAttachment(id, file, onProgress),
    meta: { successMessage: 'Attachment uploaded', errorMessage: 'Upload failed' },
    onSuccess: (report) => qc.setQueryData(queryKeys.laboratory.report(id), report),
  });
}

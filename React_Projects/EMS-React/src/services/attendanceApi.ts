import { http } from '@/api/httpClient';
import { clean } from './employeeApi';
import type { AttendanceCorrection, AttendanceQuery, AttendanceRecord, Paged, WorkMode } from '@/types/api';

interface Envelope<T> {
  data: T;
  meta?: Paged<unknown>['meta'];
}

export const attendanceApi = {
  checkIn: async (workMode?: WorkMode, remarks?: string) =>
    (
      await http.post<Envelope<AttendanceRecord>>('/attendance/check-in', clean({ workMode, remarks }), {
        skipGlobalError: true,
      })
    ).data.data,
  checkOut: async (remarks?: string) =>
    (
      await http.post<Envelope<AttendanceRecord>>('/attendance/check-out', clean({ remarks }), {
        skipGlobalError: true,
      })
    ).data.data,
  mine: async (query: AttendanceQuery = {}, signal?: AbortSignal): Promise<Paged<AttendanceRecord>> => {
    const { data } = await http.get<Envelope<AttendanceRecord[]>>('/attendance/me', {
      params: clean(query),
      signal,
    });
    return { items: data.data, meta: data.meta! };
  },
  correct: async (id: number, body: AttendanceCorrection) =>
    (await http.put<Envelope<AttendanceRecord>>(`/attendance/${id}`, body, { skipGlobalError: true })).data
      .data,
};

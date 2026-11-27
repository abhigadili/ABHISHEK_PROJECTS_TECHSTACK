import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQuery';
import type {
  AppNotification,
  AttendanceCalendar,
  AttendanceCorrection,
  AttendanceQuery,
  AttendanceRecord,
  AttendanceSummary,
  DayPart,
  Department,
  DepartmentAttendanceRow,
  DepartmentPayload,
  DepartmentReportRow,
  Designation,
  DesignationPayload,
  DesignationReportRow,
  Employee,
  EmployeeListQuery,
  EmployeePayload,
  Holiday,
  JobHistoryEntry,
  JoinersExits,
  LeaveBalanceReport,
  LeaveBalances,
  LeaveCalendar,
  LeaveHistory,
  LeaveListQuery,
  LeavePolicy,
  LeaveRequest,
  LeaveSummaryReport,
  LeaveType,
  MonthlyAttendanceRow,
  Paged,
  WeeklyOff,
  ChangeType,
  LeaveApplication,
} from '@/types/api';
import type { Role } from '@/constants/roles';

/** Remove empty values so the query string never carries `?q=&departmentId=`. */
const params = <T extends object>(p: T) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== null));

/**
 * ONE RTK Query API for all request/response server state.
 * Tags describe what each cache entry contains; mutations invalidate tags → affected queries refetch automatically.
 * Identical in-flight queries are de-duplicated and unused cache entries are dropped after `keepUnusedDataFor` seconds.
 */
export const emsApi = createApi({
  reducerPath: 'emsApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Employee',
    'JobHistory',
    'Department',
    'Designation',
    'Attendance',
    'LeaveRequest',
    'LeaveBalance',
    'LeaveType',
    'Holiday',
    'Notification',
    'Profile',
  ],
  keepUnusedDataFor: 60,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    /* ------------------------------------------------------------- employees */
    listEmployees: build.query<Paged<Employee>, EmployeeListQuery | void>({
      query: (q) => ({ url: '/employees', params: params(q ?? {}) }),
      providesTags: (r) => [
        { type: 'Employee', id: 'LIST' },
        ...(r?.items ?? []).map((e) => ({ type: 'Employee' as const, id: e.id })),
      ],
    }),
    getEmployee: build.query<Employee, number>({
      query: (id) => `/employees/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Employee', id }],
    }),
    createEmployee: build.mutation<Employee, EmployeePayload>({
      query: (body) => ({ url: '/employees', method: 'POST', body }),
      invalidatesTags: [{ type: 'Employee', id: 'LIST' }, 'Department', 'Designation'],
    }),
    updateEmployee: build.mutation<Employee, { id: number; body: EmployeePayload }>({
      query: ({ id, body }) => ({ url: `/employees/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
        { type: 'JobHistory', id },
        'Department',
        'Designation',
        'Profile',
      ],
    }),
    deactivateEmployee: build.mutation<
      null,
      { id: number; reason?: string; exitDate?: string; reassignReportsTo?: number }
    >({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/deactivate`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
        'Department',
      ],
    }),
    reactivateEmployee: build.mutation<null, number>({
      query: (id) => ({ url: `/employees/${id}/reactivate`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
        'Department',
      ],
    }),
    getJobHistory: build.query<JobHistoryEntry[], number>({
      query: (id) => `/employees/${id}/job-history`,
      providesTags: (_r, _e, id) => [{ type: 'JobHistory', id }],
    }),
    addJobHistory: build.mutation<
      null,
      { id: number; changeType: ChangeType; effectiveDate: string; notes?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/job-history`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'JobHistory', id }],
    }),
    createAccount: build.mutation<null, { id: number; role: Role; password: string }>({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/account`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
      ],
    }),
    setRole: build.mutation<null, { id: number; role: Role }>({
      query: ({ id, role }) => ({ url: `/employees/${id}/role`, method: 'PUT', body: { role } }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Employee', id },
        { type: 'Employee', id: 'LIST' },
      ],
    }),

    /* ------------------------------------------------------------- profile */
    getProfile: build.query<Employee, void>({ query: () => '/profile', providesTags: ['Profile'] }),
    updateProfile: build.mutation<Employee, Record<string, string>>({
      query: (body) => ({ url: '/profile', method: 'PATCH', body }),
      invalidatesTags: ['Profile', { type: 'Employee', id: 'LIST' }],
    }),

    /* ------------------------------------------------------------- departments / designations */
    listDepartments: build.query<
      Paged<Department>,
      { q?: string; isActive?: boolean; page?: number; limit?: number } | void
    >({
      query: (q) => ({ url: '/departments', params: params(q ?? { limit: 100 }) }),
      providesTags: (r) => [
        { type: 'Department', id: 'LIST' },
        ...(r?.items ?? []).map((d) => ({ type: 'Department' as const, id: d.id })),
      ],
    }),
    getDepartment: build.query<Department, number>({
      query: (id) => `/departments/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Department', id }],
    }),
    createDepartment: build.mutation<Department, DepartmentPayload>({
      query: (body) => ({ url: '/departments', method: 'POST', body }),
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),
    updateDepartment: build.mutation<Department, { id: number; body: DepartmentPayload }>({
      query: ({ id, body }) => ({ url: `/departments/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
      ],
    }),
    setDepartmentActive: build.mutation<null, { id: number; active: boolean }>({
      query: ({ id, active }) =>
        active
          ? { url: `/departments/${id}/activate`, method: 'POST' }
          : { url: `/departments/${id}`, method: 'DELETE' },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
      ],
    }),
    listDesignations: build.query<
      Paged<Designation>,
      { q?: string; isActive?: boolean; page?: number; limit?: number } | void
    >({
      query: (q) => ({ url: '/designations', params: params(q ?? { limit: 100 }) }),
      providesTags: [{ type: 'Designation', id: 'LIST' }],
    }),
    createDesignation: build.mutation<Designation, DesignationPayload>({
      query: (body) => ({ url: '/designations', method: 'POST', body }),
      invalidatesTags: [{ type: 'Designation', id: 'LIST' }],
    }),
    updateDesignation: build.mutation<Designation, { id: number; body: DesignationPayload }>({
      query: ({ id, body }) => ({ url: `/designations/${id}`, method: 'PUT', body }),
      invalidatesTags: [
        { type: 'Designation', id: 'LIST' },
        { type: 'Employee', id: 'LIST' },
      ],
    }),

    /* ------------------------------------------------------------- attendance */
    listAttendance: build.query<Paged<AttendanceRecord>, AttendanceQuery & { scope?: 'me' | 'all' }>({
      query: ({ scope = 'me', ...q }) => ({
        url: scope === 'me' ? '/attendance/me' : '/attendance',
        params: params(q),
      }),
      providesTags: [{ type: 'Attendance', id: 'LIST' }],
    }),
    getAttendance: build.query<AttendanceRecord, number>({
      query: (id) => `/attendance/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Attendance', id }],
    }),
    correctAttendance: build.mutation<AttendanceRecord, { id: number; body: AttendanceCorrection }>({
      query: ({ id, body }) => ({ url: `/attendance/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Attendance', id },
        { type: 'Attendance', id: 'LIST' },
      ],
    }),
    attendanceSummary: build.query<
      AttendanceSummary,
      { from?: string; to?: string; employeeId?: number } | void
    >({
      query: (q) => ({ url: '/attendance/summary', params: params(q ?? {}) }),
      providesTags: [{ type: 'Attendance', id: 'LIST' }],
    }),
    attendanceCalendar: build.query<AttendanceCalendar, { year: number; month: number; employeeId?: number }>(
      {
        query: (q) => ({ url: '/calendar/attendance', params: params(q) }),
        providesTags: [{ type: 'Attendance', id: 'LIST' }, 'Holiday'],
      },
    ),
    monthlyAttendanceReport: build.query<
      { year: number; month: number; from: string; to: string; rows: MonthlyAttendanceRow[] },
      { year: number; month: number; departmentId?: number }
    >({
      query: (q) => ({ url: '/attendance/reports/monthly', params: params(q) }),
      providesTags: [{ type: 'Attendance', id: 'LIST' }],
    }),
    departmentAttendanceReport: build.query<
      { from: string; to: string; rows: DepartmentAttendanceRow[] },
      { from?: string; to?: string } | void
    >({
      query: (q) => ({ url: '/attendance/reports/department', params: params(q ?? {}) }),
      providesTags: [{ type: 'Attendance', id: 'LIST' }],
    }),

    /* ------------------------------------------------------------- leave */
    listLeaveTypes: build.query<LeaveType[], void>({
      query: () => '/leave/types',
      providesTags: ['LeaveType'],
    }),
    createLeaveType: build.mutation<
      LeaveType,
      { code: string; name: string; isPaid: boolean; policy: Omit<LeavePolicy, 'maxConsecutiveDays'> }
    >({
      query: (body) => ({ url: '/leave/types', method: 'POST', body }),
      invalidatesTags: ['LeaveType'],
    }),
    updateLeaveType: build.mutation<LeaveType, { id: number; body: Partial<LeaveType> }>({
      query: ({ id, body }) => ({ url: `/leave/types/${id}`, method: 'PUT', body }),
      invalidatesTags: ['LeaveType'],
    }),
    getLeaveBalances: build.query<LeaveBalances, { year?: number; employeeId?: number } | void>({
      query: (q) => ({
        url: q?.employeeId ? `/leave/balances/employees/${q.employeeId}` : '/leave/balances',
        params: params({ year: q?.year }),
      }),
      providesTags: ['LeaveBalance'],
    }),
    adjustLeaveBalance: build.mutation<
      null,
      { employeeId: number; leaveTypeId: number; year: number; amount: number; note: string }
    >({
      query: (body) => ({ url: '/leave/balances/adjust', method: 'POST', body }),
      invalidatesTags: ['LeaveBalance'],
    }),
    listLeaveRequests: build.query<
      Paged<LeaveRequest>,
      LeaveListQuery & { scope?: 'me' | 'all' | 'pending' }
    >({
      query: ({ scope = 'me', ...q }) => ({
        url:
          scope === 'me'
            ? '/leave/requests/me'
            : scope === 'pending'
              ? '/leave/requests/pending-approvals'
              : '/leave/requests',
        params: params(q),
      }),
      providesTags: (r) => [
        { type: 'LeaveRequest', id: 'LIST' },
        ...(r?.items ?? []).map((l) => ({ type: 'LeaveRequest' as const, id: l.id })),
      ],
    }),
    getLeaveRequest: build.query<LeaveRequest, number>({
      query: (id) => `/leave/requests/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'LeaveRequest', id }],
    }),
    applyLeave: build.mutation<LeaveRequest, LeaveApplication & { dayPart: DayPart }>({
      query: (body) => ({ url: '/leave/requests', method: 'POST', body }),
      invalidatesTags: [{ type: 'LeaveRequest', id: 'LIST' }, 'LeaveBalance', 'Notification'],
    }),
    decideLeave: build.mutation<LeaveRequest, { id: number; action: 'approve' | 'reject'; note?: string }>({
      query: ({ id, action, note }) => ({
        url: `/leave/requests/${id}/${action}`,
        method: 'POST',
        body: note ? { note } : {},
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'LeaveRequest', id },
        { type: 'LeaveRequest', id: 'LIST' },
        'LeaveBalance',
      ],
    }),
    cancelLeave: build.mutation<LeaveRequest, number>({
      query: (id) => ({ url: `/leave/requests/${id}/cancel`, method: 'POST', body: {} }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'LeaveRequest', id },
        { type: 'LeaveRequest', id: 'LIST' },
        'LeaveBalance',
      ],
    }),
    leaveHistory: build.query<LeaveHistory, { year?: number } | void>({
      query: (q) => ({ url: '/leave/history', params: params(q ?? {}) }),
      providesTags: [{ type: 'LeaveRequest', id: 'LIST' }, 'LeaveBalance'],
    }),
    leaveCalendar: build.query<LeaveCalendar, { year: number; month: number; departmentId?: number }>({
      query: (q) => ({ url: '/calendar/leave', params: params(q) }),
      providesTags: [{ type: 'LeaveRequest', id: 'LIST' }, 'Holiday'],
    }),

    /* ------------------------------------------------------------- holidays */
    listHolidays: build.query<Holiday[], { from?: string; to?: string } | void>({
      query: (q) => ({ url: '/holidays', params: params(q ?? {}) }),
      providesTags: ['Holiday'],
    }),
    createHoliday: build.mutation<Holiday, { holidayDate: string; name: string; isOptional?: boolean }>({
      query: (body) => ({ url: '/holidays', method: 'POST', body }),
      invalidatesTags: ['Holiday'],
    }),
    updateHoliday: build.mutation<
      Holiday,
      { id: number; body: Partial<{ holidayDate: string; name: string; isOptional: boolean }> }
    >({
      query: ({ id, body }) => ({ url: `/holidays/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Holiday'],
    }),
    deleteHoliday: build.mutation<null, number>({
      query: (id) => ({ url: `/holidays/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Holiday'],
    }),
    listWeeklyOffs: build.query<WeeklyOff[], void>({
      query: () => '/weekly-offs',
      providesTags: ['Holiday'],
    }),
    setWeeklyOffs: build.mutation<null, number[]>({
      query: (days) => ({ url: '/weekly-offs', method: 'PUT', body: { days } }),
      invalidatesTags: ['Holiday'],
    }),

    /* ------------------------------------------------------------- notifications */
    listNotifications: build.query<
      Paged<AppNotification>,
      { unread?: boolean; page?: number; limit?: number } | void
    >({
      query: (q) => ({ url: '/notifications', params: params(q ?? {}) }),
      providesTags: ['Notification'],
    }),
    markNotificationsRead: build.mutation<null, number[] | void>({
      // omitting `ids` marks EVERY notification as read (backend contract)
      query: (ids) => ({
        url: '/notifications/read',
        method: 'POST',
        body: ids && ids.length ? { ids } : {},
      }),
      invalidatesTags: ['Notification'],
    }),

    /* ------------------------------------------------------------- reports */
    joinersExitsReport: build.query<JoinersExits, { from?: string; to?: string } | void>({
      query: (q) => ({ url: '/reports/joiners-exits', params: params(q ?? {}) }),
    }),
    leaveBalanceReport: build.query<LeaveBalanceReport, { year?: number; departmentId?: number } | void>({
      query: (q) => ({ url: '/reports/leave-balances', params: params(q ?? {}) }),
      providesTags: ['LeaveBalance'],
    }),
    leaveSummaryReport: build.query<LeaveSummaryReport, { from?: string; to?: string } | void>({
      query: (q) => ({ url: '/reports/leave-summary', params: params(q ?? {}) }),
      providesTags: [{ type: 'LeaveRequest', id: 'LIST' }],
    }),
    departmentsReport: build.query<DepartmentReportRow[], void>({
      query: () => '/reports/departments',
      providesTags: ['Department'],
    }),
    designationsReport: build.query<DesignationReportRow[], void>({
      query: () => '/reports/designations',
      providesTags: ['Designation'],
    }),
  }),
});

export const {
  useListEmployeesQuery,
  useGetEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useReactivateEmployeeMutation,
  useGetJobHistoryQuery,
  useAddJobHistoryMutation,
  useCreateAccountMutation,
  useSetRoleMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useListDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useSetDepartmentActiveMutation,
  useListDesignationsQuery,
  useCreateDesignationMutation,
  useUpdateDesignationMutation,
  useListAttendanceQuery,
  useGetAttendanceQuery,
  useCorrectAttendanceMutation,
  useAttendanceSummaryQuery,
  useAttendanceCalendarQuery,
  useMonthlyAttendanceReportQuery,
  useDepartmentAttendanceReportQuery,
  useListLeaveTypesQuery,
  useCreateLeaveTypeMutation,
  useUpdateLeaveTypeMutation,
  useGetLeaveBalancesQuery,
  useAdjustLeaveBalanceMutation,
  useListLeaveRequestsQuery,
  useGetLeaveRequestQuery,
  useApplyLeaveMutation,
  useDecideLeaveMutation,
  useCancelLeaveMutation,
  useLeaveHistoryQuery,
  useLeaveCalendarQuery,
  useListHolidaysQuery,
  useCreateHolidayMutation,
  useUpdateHolidayMutation,
  useDeleteHolidayMutation,
  useListWeeklyOffsQuery,
  useSetWeeklyOffsMutation,
  useListNotificationsQuery,
  useMarkNotificationsReadMutation,
  useJoinersExitsReportQuery,
  useLeaveBalanceReportQuery,
  useLeaveSummaryReportQuery,
  useDepartmentsReportQuery,
  useDesignationsReportQuery,
} = emsApi;

import { createAction, createReducer } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import type { AppointmentStatus } from '@/types';

/** React Redux - Appointment Management UI state, written with createAction + createReducer (builder API). */
export interface AppointmentUiState { view: 'list' | 'calendar'; status: AppointmentStatus | 'ALL'; month: string; selectedDate: string | null; search: string }
export const appointmentsInitial: AppointmentUiState = { view: 'list', status: 'ALL', month: dayjs().format('YYYY-MM'), selectedDate: null, search: '' };

export const setView = createAction<AppointmentUiState['view']>('appointmentsUi/setView');
export const setStatusFilter = createAction<AppointmentUiState['status']>('appointmentsUi/setStatus');
export const setMonth = createAction<string>('appointmentsUi/setMonth');
export const selectDate = createAction<string | null>('appointmentsUi/selectDate');
export const setAppointmentSearch = createAction<string>('appointmentsUi/setSearch');

export const appointmentsUiReducer = createReducer(appointmentsInitial, (b) => {
  b.addCase(setView, (s, a) => { s.view = a.payload; })
    .addCase(setStatusFilter, (s, a) => { s.status = a.payload; })
    .addCase(setMonth, (s, a) => { s.month = a.payload; s.selectedDate = null; })
    .addCase(selectDate, (s, a) => { s.selectedDate = a.payload; })
    .addCase(setAppointmentSearch, (s, a) => { s.search = a.payload; });
});

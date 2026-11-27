import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { Appointment, BookAppointmentRequest, RescheduleRequest } from '../../core/models';
import type { FeedScope } from '../entities/appointments.entity';

export const AppointmentsActions = createActionGroup({
  source: 'Appointments',
  events: {
    'Load Feed': props<{ scope: FeedScope }>(),
    'Load Feed Success': props<{ appointments: Appointment[] }>(),
    'Load Feed Failure': props<{ error: string }>(),
    'Book': props<{ request: BookAppointmentRequest }>(),
    'Book Success': props<{ appointment: Appointment }>(),
    'Book Failure': props<{ error: string; status: number }>(),
    'Cancel': props<{ id: number; reason?: string }>(),
    'Cancel Success': props<{ appointment: Appointment }>(),
    'Cancel Failure': props<{ id: number; error: string }>(),
    'Reschedule': props<{ id: number; request: RescheduleRequest }>(),
    'Reschedule Success': props<{ appointment: Appointment }>(),
    'Reschedule Failure': props<{ error: string }>(),
    'Complete': props<{ id: number; notes?: string }>(),
    'Complete Success': props<{ appointment: Appointment }>(),
    'Complete Failure': props<{ error: string }>(),
    'Statuses Refreshed': props<{ appointments: Appointment[] }>(),
    'Clear': emptyProps(),
  },
});

import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { Booking, SavedPassenger, StationDetail, Train } from '../models/models';
import { BookingService, PassengerService } from './account.services';
import { StationService, TrainService } from './catalog.services';

const bad = (router: Router, to: string[]) => { void router.navigate(to); return of(null); };
/** Resolvers load data that must exist before the page renders; a 404 / 403 redirects instead of showing an empty page. */
export const trainResolver: ResolveFn<Train | null> = (r) => { const router = inject(Router); return inject(TrainService).get(Number(r.paramMap.get('id'))).pipe(catchError(() => bad(router, ['/trains']))); };
export const stationResolver: ResolveFn<StationDetail | null> = (r) => { const router = inject(Router); return inject(StationService).get(Number(r.paramMap.get('id'))).pipe(catchError(() => bad(router, ['/stations']))); };
export const bookingResolver: ResolveFn<Booking | null> = (r) => { const router = inject(Router); return inject(BookingService).get(Number(r.paramMap.get('id'))).pipe(catchError(() => bad(router, ['/app/bookings']))); };
export const passengerResolver: ResolveFn<SavedPassenger | null> = (r) => { const router = inject(Router); return inject(PassengerService).get(Number(r.paramMap.get('id'))).pipe(catchError(() => bad(router, ['/app/passengers']))); };

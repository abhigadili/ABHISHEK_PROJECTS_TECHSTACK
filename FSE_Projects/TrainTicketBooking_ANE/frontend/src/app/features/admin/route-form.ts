import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import type { RoutePayload, Station, TrainRoute } from '../../core/models/models';
import { stationSelected, timeHHmm } from '../../shared/validators/validators';

export type StopGroup = FormGroup<{ station: FormControl<Station | string | null>; arrivalTime: FormControl<string>; departureTime: FormControl<string>; dayOffset: FormControl<number>; distanceKm: FormControl<number> }>;
export type RouteGroup = FormGroup<{ name: FormControl<string>; stops: FormArray<StopGroup> }>;

export function newStop(fb: NonNullableFormBuilder, s?: { station?: Station; arrivalTime?: string | null; departureTime?: string | null; dayOffset?: number; distanceKm?: number }): StopGroup {
  return fb.group({
    station: new FormControl<Station | string | null>(s?.station ?? null, [Validators.required, stationSelected]),
    arrivalTime: fb.control(s?.arrivalTime ?? '', [timeHHmm]), departureTime: fb.control(s?.departureTime ?? '', [timeHHmm]),
    dayOffset: fb.control(s?.dayOffset ?? 0, [Validators.required, Validators.min(0), Validators.max(5)]), distanceKm: fb.control(s?.distanceKm ?? 0, [Validators.required, Validators.min(0), Validators.max(10000)]),
  });
}
/** Mirrors the backend route rules: >= 2 stops, unique stations, non-decreasing distance, first stop has no arrival, last stop has no departure. */
export const routeRules = (c: import('@angular/forms').AbstractControl): ValidationErrors | null => {
  const stops = (c.get('stops') as FormArray<StopGroup>).controls; const errs: ValidationErrors = {};
  if (stops.length < 2) errs['minStops'] = true;
  const ids = stops.map((s) => (typeof s.controls.station.value === 'object' ? (s.controls.station.value as Station | null)?.id : undefined)).filter(Boolean);
  if (new Set(ids).size !== ids.length) errs['duplicateStation'] = true;
  let last = -1; if (stops.some((s) => { const d = s.controls.distanceKm.value; const bad = d < last; last = d; return bad; })) errs['distanceOrder'] = true;
  return Object.keys(errs).length ? errs : null;
};
/** Conditional controls: the first stop has no arrival, the last has no departure; others need both. */
export function syncStops(route: RouteGroup) {
  const stops = route.controls.stops.controls;
  stops.forEach((g, i) => {
    const arr = g.controls.arrivalTime, dep = g.controls.departureTime;
    if (i === 0) { arr.disable({ emitEvent: false }); arr.setValue('', { emitEvent: false }); } else { arr.enable({ emitEvent: false }); arr.setValidators([Validators.required, timeHHmm]); }
    if (i === stops.length - 1) { dep.disable({ emitEvent: false }); dep.setValue('', { emitEvent: false }); } else { dep.enable({ emitEvent: false }); dep.setValidators([Validators.required, timeHHmm]); }
    arr.updateValueAndValidity({ emitEvent: false }); dep.updateValueAndValidity({ emitEvent: false });
  });
  route.updateValueAndValidity({ emitEvent: false });
}
export function buildRoute(fb: NonNullableFormBuilder, r?: TrainRoute | null): RouteGroup {
  const g = fb.group({ name: fb.control(r?.name ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]), stops: fb.array<StopGroup>([]) }, { validators: [routeRules] }) as RouteGroup;
  (r?.stops?.length ? r.stops : [undefined, undefined]).forEach((s) => g.controls.stops.push(newStop(fb, s ? { station: s.station, arrivalTime: s.arrivalTime, departureTime: s.departureTime, dayOffset: s.dayOffset, distanceKm: s.distanceKm } : undefined)));
  syncStops(g); return g;
}
export function routePayload(g: RouteGroup): RoutePayload {
  const stops = g.controls.stops.controls; const last = stops.length - 1;
  return { name: g.controls.name.value.trim(), stops: stops.map((s, i) => ({ stationId: (s.controls.station.value as Station).id, arrivalTime: i === 0 ? null : s.controls.arrivalTime.value || null, departureTime: i === last ? null : s.controls.departureTime.value || null, dayOffset: Number(s.controls.dayOffset.value), distanceKm: Number(s.controls.distanceKm.value) })) };
}

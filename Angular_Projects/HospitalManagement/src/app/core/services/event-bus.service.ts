import { Injectable } from '@angular/core';
import { AsyncSubject, BehaviorSubject, ReplaySubject, Subject } from 'rxjs';

export type AppEvent =
  | { readonly type: 'appointment-changed'; readonly appointmentId: number; readonly status: string }
  | { readonly type: 'patient-registered'; readonly patientId: number }
  | { readonly type: 'payment-completed'; readonly billId: number };

/**
 * Communication service – all four RxJS subject flavours with a real purpose:
 *  - Subject          : fire-and-forget domain events (`events$`)
 *  - BehaviorSubject  : current value + replay of the latest to new subscribers (`lastActivity$`, shared application state)
 *  - ReplaySubject    : the last 20 events for components that mount later (activity feed)
 *  - AsyncSubject     : emits only the FINAL value on completion (`bootCompleted$`: one-shot "application ready" signal)
 */
@Injectable({ providedIn: 'root' })
export class EventBusService {
  private readonly events = new Subject<AppEvent>();
  readonly events$ = this.events.asObservable();

  private readonly lastActivity = new BehaviorSubject<string>('No activity yet');
  readonly lastActivity$ = this.lastActivity.asObservable();

  private readonly history = new ReplaySubject<AppEvent>(20);
  readonly history$ = this.history.asObservable();

  private readonly boot = new AsyncSubject<{ readonly at: Date }>();
  readonly bootCompleted$ = this.boot.asObservable();

  emit(e: AppEvent): void {
    this.events.next(e);
    this.history.next(e);
    this.lastActivity.next(this.describe(e));
  }
  /** Called once when the shell is ready; AsyncSubject delivers the value only after complete(). */
  completeBoot(): void {
    this.boot.next({ at: new Date() });
    this.boot.complete();
  }
  private describe(e: AppEvent): string {
    switch (e.type) {
      case 'appointment-changed': return `Appointment #${e.appointmentId} is now ${e.status.toLowerCase()}`;
      case 'patient-registered': return `Patient #${e.patientId} registered`;
      case 'payment-completed': return `Payment completed for bill #${e.billId}`;
    }
  }
}

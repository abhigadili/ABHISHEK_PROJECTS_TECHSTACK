import { AfterContentChecked, AfterContentInit, AfterViewChecked, AfterViewInit, ChangeDetectionStrategy, Component, DoCheck, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, contentChild, inject, viewChild } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import type { Appointment } from '../../core/models';
import { AppointmentStatusPipe } from '../../shared/pipes/pipes';
import { LifecycleLogService } from './lifecycle-log.service';

/**
 * APPOINTMENT SUMMARY CARD – demonstrates all eight lifecycle hooks in their natural order, each with a real job:
 *   ngOnChanges            appointment input replaced → react to the previous/current status (flags a status change)
 *   ngOnInit               one-time initialisation (appointment initialisation log, derive initial label)
 *   ngDoCheck              custom change detection of a mutable object input (`notes` edited in place is not seen by OnPush)
 *   ngAfterContentInit     the projected <ng-content> (doctor's notes) exists → read it through contentChild()
 *   ngAfterContentChecked  projected content checked after every parent pass
 *   ngAfterViewInit        the card's own view exists → measure/focus through viewChild()
 *   ngAfterViewChecked     view checked – used (sparingly!) to keep a scroll position
 *   ngOnDestroy            cleanup (timer / listener) when the page is left
 * The log is written to LifecycleLogService and displayed by the details page.
 */
@Component({
  selector: 'app-appointment-summary',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, AppointmentStatusPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #card class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Appointment #{{ appointment?.id }}</div>
          <div class="text-lg font-bold">{{ appointment?.date | date: 'EEEE, dd MMM yyyy' }} · {{ appointment?.startTime }}–{{ appointment?.endTime }}</div></div>
        <span class="rounded-full px-3 py-1 text-xs font-semibold" [class]="appointment?.status | appointmentStatus: 'classes'">{{ appointment?.status | appointmentStatus }}</span>
      </div>
      <div class="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><span class="block text-xs text-slate-500">Patient</span>{{ appointment?.patientName }}</div><div><span class="block text-xs text-slate-500">Doctor</span>{{ appointment?.doctorName }}</div><div><span class="block text-xs text-slate-500">Fee</span>{{ appointment?.fee | currency: 'INR' }} · {{ appointment?.paymentStatus }}</div></div>
      @if (statusChange) { <p class="mt-3 rounded bg-sky-50 px-3 py-1.5 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">{{ statusChange }}</p> }
      <div #projected class="mt-3 empty:hidden"><ng-content /></div>
    </div>`,
})
export class AppointmentSummaryComponent implements OnChanges, OnInit, DoCheck, AfterContentInit, AfterContentChecked, AfterViewInit, AfterViewChecked, OnDestroy {
  private readonly log = inject(LifecycleLogService);
  private readonly name = 'AppointmentSummary';
  @Input() appointment: Appointment | null = null;
  protected statusChange = '';
  private lastNotes: string | null | undefined;
  private lastStatus?: string;
  private ticker?: ReturnType<typeof setInterval>;

  // signal-based queries (the view/content queries are signals; hooks tell WHEN they are safe to read)
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  private readonly projected = viewChild<ElementRef<HTMLElement>>('projected');
  private readonly projectedNote = contentChild<ElementRef<HTMLElement>>('note');

  ngOnChanges(changes: SimpleChanges): void {
    const c = changes['appointment'];
    if (c && !c.firstChange) {
      const prev = (c.previousValue as Appointment | null)?.status, cur = (c.currentValue as Appointment | null)?.status;
      this.statusChange = prev && cur && prev !== cur ? `Status changed ${prev.toLowerCase()} → ${cur.toLowerCase()}` : '';
    }
    this.log.log(this.name, 'ngOnChanges', Object.keys(changes).join(', '));
  }
  ngOnInit(): void {
    this.lastStatus = this.appointment?.status;
    this.log.log(this.name, 'ngOnInit', `appointment #${this.appointment?.id} initialised`);
    this.ticker = setInterval(() => undefined, 60_000); // a resource that MUST be released in ngOnDestroy
  }
  ngDoCheck(): void {
    // in-place mutation of `notes` is invisible to OnPush input comparison – ngDoCheck can detect it manually
    if (this.appointment && this.appointment.notes !== this.lastNotes) { this.lastNotes = this.appointment.notes; this.log.log(this.name, 'ngDoCheck', 'notes changed in place'); }
    else this.log.log(this.name, 'ngDoCheck');
  }
  ngAfterContentInit(): void { this.log.log(this.name, 'ngAfterContentInit', `projected note: ${this.projectedNote() ? 'present' : 'none'}`); }
  ngAfterContentChecked(): void { this.log.log(this.name, 'ngAfterContentChecked'); }
  ngAfterViewInit(): void { this.log.log(this.name, 'ngAfterViewInit', `card width ${Math.round(this.card()?.nativeElement.offsetWidth ?? 0)} px`); }
  ngAfterViewChecked(): void { this.log.log(this.name, 'ngAfterViewChecked'); void this.projected(); }
  ngOnDestroy(): void { clearInterval(this.ticker); this.log.log(this.name, 'ngOnDestroy', 'timer cleared'); void this.lastStatus; }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subject, takeUntil, timer } from 'rxjs';

/**
 * Ticking clock for the check-in card (people check in against "now").
 * Classic lifecycle usage on purpose:
 *  - ngOnInit      starts the 1-second timer (not in the constructor: inputs/DI are ready, rendering is about to begin)
 *  - takeUntil     tears the stream down when `destroy$` fires …
 *  - ngOnDestroy   … which we trigger here, so the timer never outlives the component
 *  - markForCheck  the component is OnPush, so each tick explicitly schedules a re-render of just this view
 */
@Component({
  selector: 'app-live-clock',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<time [attr.datetime]="now.toISOString()" data-testid="live-clock">{{ now | date: 'mediumTime' }}</time>`,
  styles: `time { font-variant-numeric: tabular-nums; font-weight: 500; }`,
})
export class LiveClockComponent implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  protected now = new Date();

  ngOnInit(): void {
    timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.now = new Date();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

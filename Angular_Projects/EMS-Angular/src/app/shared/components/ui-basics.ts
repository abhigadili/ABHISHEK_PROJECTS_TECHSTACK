import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppError } from '../../core/models/api.models';

/**
 * Page title row. Uses content projection with a named slot: anything marked `pageActions`
 * (e.g. `<button pageActions mat-flat-button>`) is placed on the right.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content select="[pageActions]" /></div>
    </header>
  `,
  styles: `
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 1.6rem; font-weight: 500; }
    .subtitle { margin: 4px 0 0; color: var(--ems-muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}

export type BadgeKind = 'success' | 'warn' | 'danger' | 'info' | 'neutral';

const KIND_BY_VALUE: Record<string, BadgeKind> = {
  ACTIVE: 'success', APPROVED: 'success', PRESENT: 'success', true: 'success',
  PENDING: 'warn', HALF_DAY: 'warn', ON_LEAVE: 'info', HOLIDAY: 'info', WEEKLY_OFF: 'neutral',
  INACTIVE: 'neutral', CANCELLED: 'neutral', false: 'neutral',
  TERMINATED: 'danger', REJECTED: 'danger', ABSENT: 'danger',
};

/** Coloured status pill. The colour is derived from the value (computed signal) unless `kind` is set explicitly. */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None, // demonstrates ViewEncapsulation: the badge palette is intentionally global-by-class
  template: `<span class="badge badge-{{ resolvedKind() }}"><ng-content />{{ label() }}</span>`,
  styles: `
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; line-height: 20px; white-space: nowrap; }
    .badge-success { background: #e6f4ea; color: #137333; }
    .badge-warn { background: #fef7e0; color: #b06000; }
    .badge-danger { background: #fce8e6; color: #c5221f; }
    .badge-info { background: #e8f0fe; color: #1a56c4; }
    .badge-neutral { background: #eceff1; color: #455a64; }
  `,
})
export class StatusBadgeComponent {
  readonly value = input<string | boolean | null>(null);
  readonly label = input<string>('');
  readonly kind = input<BadgeKind | null>(null);
  readonly resolvedKind = computed<BadgeKind>(() => this.kind() ?? KIND_BY_VALUE[String(this.value())] ?? 'neutral');
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status">
      <mat-icon>{{ icon() }}</mat-icon>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty { text-align: center; padding: 40px 16px; color: var(--ems-muted); }
    mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.6; }
    h3 { margin: 8px 0 4px; font-weight: 500; color: var(--ems-text); }
    p { margin: 0 0 12px; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing to show');
  readonly message = input('');
}

@Component({
  selector: 'app-error-message',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="error" role="alert">
        <mat-icon>error_outline</mat-icon>
        <div class="text">
          <strong>{{ e.message }}</strong>
          @if (e.requestId) {
            <small>Reference: {{ e.requestId }}</small>
          }
        </div>
        @if (retryable()) {
          <button mat-stroked-button type="button" (click)="retry.emit()">Retry</button>
        }
      </div>
    }
  `,
  styles: `
    .error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; background: #fce8e6; color: #c5221f; margin-bottom: 16px; }
    .text { flex: 1; display: flex; flex-direction: column; }
    small { opacity: 0.8; }
  `,
})
export class ErrorMessageComponent {
  readonly error = input<AppError | null>(null);
  readonly retryable = input(true);
  readonly retry = output<void>();
}

@Component({
  selector: 'app-notice-banner',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="notice" role="note"><mat-icon>info</mat-icon><span><ng-content /></span></div>`,
  styles: `
    .notice { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 8px; background: #fff8e1; color: #6d4c00; font-size: 13px; margin-bottom: 16px; }
    mat-icon { flex: none; }
  `,
})
export class NoticeBannerComponent {}

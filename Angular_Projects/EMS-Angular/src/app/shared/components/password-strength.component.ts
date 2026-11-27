import { NgClass, NgFor, NgIf, NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

export interface PasswordRule {
  label: string;
  ok: boolean;
}

/**
 * Live password checklist + strength meter (mirrors the backend policy; the backend stays the authority).
 *
 * This component deliberately uses the *classic* input decorator + `ngOnChanges` and the *legacy* structural directives
 * (`*ngIf`, `*ngFor` with `trackBy`, `[ngSwitch]`, `[ngClass]`, `[ngStyle]`) — the rest of the app uses signal inputs and
 * `@if / @for / @switch`. Equivalents are noted next to each use.
 */
@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meter" *ngIf="password" aria-hidden="true">
      <!-- modern: <div class="bar" [style.width.%]="percent"> ; legacy ngStyle below -->
      <div class="bar" [ngClass]="level" [ngStyle]="{ 'width.%': percent }"></div>
    </div>
    <p class="label" *ngIf="password" [ngSwitch]="level" data-testid="strength-label">
      <!-- modern: @switch (level) { @case ('weak') { … } } -->
      <span *ngSwitchCase="'weak'">Weak password</span>
      <span *ngSwitchCase="'fair'">Fair — add the missing items</span>
      <span *ngSwitchCase="'strong'">Strong password</span>
      <span *ngSwitchDefault>Enter a password</span>
    </p>
    <ul class="rules" *ngIf="password">
      <!-- modern: @for (r of rules; track r.label) -->
      <li *ngFor="let r of rules; trackBy: trackRule" [ngClass]="r.ok ? 'ok' : 'todo'">{{ r.ok ? '✓' : '○' }} {{ r.label }}</li>
    </ul>
  `,
  styles: `
    :host { display: block; margin: -8px 0 12px; }
    .meter { height: 6px; background: #e0e3eb; border-radius: 3px; overflow: hidden; }
    .bar { height: 100%; transition: width 0.2s; }
    .bar.weak { background: #ea4335; } .bar.fair { background: #fbbc04; } .bar.strong { background: #34a853; }
    .label { margin: 4px 0; font-size: 12px; color: var(--ems-muted); }
    .rules { list-style: none; margin: 0; padding: 0; font-size: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 2px 12px; }
    .ok { color: #137333; } .todo { color: var(--ems-muted); }
  `,
})
export class PasswordStrengthComponent implements OnChanges {
  @Input() password = '';

  rules: PasswordRule[] = [];
  percent = 0;
  level: 'none' | 'weak' | 'fair' | 'strong' = 'none';

  /** Runs whenever the bound `password` input changes (before the view is checked). */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['password']) return;
    const p = this.password ?? '';
    this.rules = [
      { label: '10+ characters', ok: p.length >= 10 },
      { label: 'Lowercase letter', ok: /[a-z]/.test(p) },
      { label: 'Uppercase letter', ok: /[A-Z]/.test(p) },
      { label: 'Digit', ok: /\d/.test(p) },
      { label: 'Special character', ok: /[^A-Za-z0-9]/.test(p) },
    ];
    const met = this.rules.filter((r) => r.ok).length;
    this.percent = p ? (met / this.rules.length) * 100 : 0;
    this.level = !p ? 'none' : met <= 2 ? 'weak' : met < this.rules.length ? 'fair' : 'strong';
  }

  trackRule = (_: number, r: PasswordRule): string => r.label;
}

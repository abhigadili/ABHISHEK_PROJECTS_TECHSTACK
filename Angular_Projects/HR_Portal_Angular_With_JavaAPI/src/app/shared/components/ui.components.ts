import { ChangeDetectionStrategy, Component, Directive, Input, TemplateRef, contentChildren, input, output, computed, effect, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { UiPipe } from '../pipes/format.pipes';

@Component({
  selector: 'app-page-header', standalone: true, imports: [UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
    <div><h1 class="page-title">{{ title() | ui }}</h1>@if (subtitle()) { <p class="m-0 text-muted" style="font-size:13px">{{ subtitle() | ui }}</p> }</div>
    <div class="d-flex flex-wrap gap-2 align-items-center"><ng-content /></div></div>`,
})
export class PageHeaderComponent { title = input.required<string>(); subtitle = input<string>(''); }

@Component({
  selector: 'app-card', standalone: true, imports: [UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="hr-card" [class.mb-3]="spaced()">
    @if (title()) { <div class="hr-card-head"><h2 class="hr-card-title">{{ title() | ui }}</h2><div class="d-flex gap-2 align-items-center flex-wrap"><ng-content select="[actions]" /></div></div> }
    <div [class]="flush() ? '' : 'hr-card-body'"><ng-content /></div></section>`,
})
export class CardComponent { title = input<string>(''); flush = input(false); spaced = input(false); }

@Component({
  selector: 'app-kpi-card', standalone: true, imports: [UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="hr-card p-3 h-100"><div class="d-flex align-items-center justify-content-between"><span class="text-muted" style="font-size:12px;font-weight:600">{{ label() | ui }}</span>
    <i class="pi" [class]="icon()" [style.color]="color()"></i></div>
    @if (loading()) { <div class="skeleton mt-2" style="height:28px;width:60%"></div> } @else { <div class="mt-1" style="font-size:24px;font-weight:700;color:var(--hr-text)">{{ value() }}</div> }
    @if (hint()) { <div class="text-muted" style="font-size:11px">{{ hint() | ui }}</div> }</div>`,
})
export class KpiCardComponent { label = input.required<string>(); value = input<string | number>('—'); icon = input('pi-chart-bar'); color = input('var(--hr-primary)'); loading = input(false); hint = input(''); }

@Component({
  selector: 'app-loading-block', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="p-2" aria-busy="true" aria-live="polite">@for (r of rowsArr(); track r) { <div class="skeleton mb-2" style="height:18px" [style.width.%]="100 - (r * 7) % 35"></div> }</div>`,
})
export class LoadingBlockComponent { rows = input(4); rowsArr = computed(() => Array.from({ length: this.rows() }, (_, i) => i)); }

@Component({
  selector: 'app-empty-state', standalone: true, imports: [TranslateModule, UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="text-center p-4 text-muted"><i class="pi pi-inbox" style="font-size:28px"></i>
    <div class="mt-2 fw-semibold" style="color:var(--hr-text)">{{ title() ? (title() | ui) : ('common.noData' | translate) }}</div>
    <div style="font-size:12px">{{ hint() ? (hint() | ui) : ('common.noDataHint' | translate) }}</div><ng-content /></div>`,
})
export class EmptyStateComponent { title = input(''); hint = input(''); }

@Component({
  selector: 'app-error-state', standalone: true, imports: [TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div role="alert" class="text-center p-4"><i class="pi pi-exclamation-triangle" style="font-size:26px;color:var(--hr-danger)"></i>
    <div class="mt-2 fw-semibold">{{ 'common.error' | translate }}</div><div class="text-muted" style="font-size:12px">{{ message() }}</div>
    @if (retryable()) { <button type="button" class="btn-hr outline sm mt-2" (click)="retry.emit()"><i class="pi pi-refresh"></i>{{ 'common.retry' | translate }}</button> }</div>`,
})
export class ErrorStateComponent {
  error = input<unknown>(); retryable = input(true); retry = output<void>();
  message = computed(() => { const e = this.error(); return e instanceof Error ? e.message : String(e ?? ''); });
}

@Component({
  selector: 'app-badge', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="hr-badge" [class]="tone()"><ng-content /></span>`,
})
export class BadgeComponent { tone = input<'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'>('neutral'); }
void Input;

/** Tab: `<ng-template appTab="key" label="Title">content (created lazily when the tab opens)</ng-template>` */
@Directive({ selector: 'ng-template[appTab]', standalone: true })
export class TabDirective { constructor(public tpl: TemplateRef<any>) {} appTab = input.required<string>(); label = input<string>(''); hidden = input(false); }

/** Material tab group with lazy tab content; the label goes through the `ui` phrase dictionary. */
@Component({
  selector: 'app-tabs', standalone: true, imports: [MatTabsModule, NgTemplateOutlet, UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-tab-group [selectedIndex]="index()" (selectedIndexChange)="index.set($event)" animationDuration="150ms" mat-stretch-tabs="false" mat-align-tabs="start" [dynamicHeight]="false">
    @for (t of visible(); track t.appTab()) { <mat-tab [label]="t.label() | ui"><ng-template matTabContent><div class="pt-3"><ng-container [ngTemplateOutlet]="t.tpl" /></div></ng-template></mat-tab> }</mat-tab-group>`,
})
export class TabsComponent {
  tabs = contentChildren(TabDirective); visible = computed(() => this.tabs().filter((t) => !t.hidden())); index = signal(0);
  /** tab key to open first (e.g. from a `?tab=` query parameter) */ initial = input<string | undefined>();
  constructor() { effect(() => { const k = this.initial(); const i = this.visible().findIndex((t) => t.appTab() === k); if (k && i >= 0) untracked(() => this.index.set(i)); }); }
}

/** Small titled block used inside tabs. */
@Component({
  selector: 'app-sub', standalone: true, imports: [UiPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mb-4"><div class="field-label">{{ title() | ui }}</div><ng-content /></div>`,
})
export class SubComponent { title = input.required<string>(); }

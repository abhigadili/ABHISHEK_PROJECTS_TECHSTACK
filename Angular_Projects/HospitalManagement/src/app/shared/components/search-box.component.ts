import { ChangeDetectionStrategy, Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';

/**
 * Debounced search box. `value` is a model() (shared form control); `search` is an output built from an Observable
 * (toObservable → debounceTime → distinctUntilChanged → outputFromObservable). The "/" shortcut focuses the field (viewChild).
 */
@Component({
  selector: 'app-search-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="relative w-full max-w-sm">
      <input #box type="search" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 pr-8 text-sm dark:border-slate-600" [placeholder]="placeholder()" [attr.aria-label]="placeholder()" [value]="value()" (input)="value.set($any($event.target).value)" />
      @if (value()) { <button type="button" class="absolute right-2 top-2 text-slate-400 hover:text-slate-700" aria-label="Clear search" (click)="value.set('')">✕</button> }
    </div>`,
})
export class SearchBoxComponent {
  readonly placeholder = input('Search…  ( / )');
  readonly debounce = input(350);
  readonly value = model('');
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  readonly search = outputFromObservable(toObservable(this.value).pipe(skip(1), debounceTime(350), distinctUntilChanged()));
  readonly focusRequested = output<void>();
  constructor() { effect(() => void this.debounce()); }
  focus() { this.box().nativeElement.focus(); }
  protected onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); this.focus(); }
  }
}

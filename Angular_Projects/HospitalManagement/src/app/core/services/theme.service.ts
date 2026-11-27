import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/** Theme configuration service: one signal drives Tailwind (`.dark`), Material (`color-scheme`), PrimeNG (`.dark`) and Bootstrap (`data-bs-theme`). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private static readonly KEY = 'hms.ng.theme';
  readonly mode = signal<ThemeMode>(this.initial());

  constructor() {
    // effect(): runs whenever `mode` changes – applies the theme to <html> and persists it.
    effect(() => {
      const m = this.mode();
      const root = this.doc.documentElement;
      root.classList.toggle('dark', m === 'dark');
      root.style.colorScheme = m;
      root.setAttribute('data-bs-theme', m);
      try { localStorage.setItem(ThemeService.KEY, m); } catch { /* ignore */ }
    });
  }
  toggle() { this.mode.update((m) => (m === 'light' ? 'dark' : 'light')); }

  private initial(): ThemeMode {
    try {
      const s = localStorage.getItem(ThemeService.KEY);
      if (s === 'light' || s === 'dark') return s;
    } catch { /* ignore */ }
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}

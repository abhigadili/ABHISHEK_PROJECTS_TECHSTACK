import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'hr.theme';
/** Light / dark / system theme. Sets `data-theme` on <html> (read by the SCSS tokens, Tailwind `dark:` variant, PrimeNG and Material `color-scheme`). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.read());
  private readonly systemDark = signal(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  readonly resolved = computed<'light' | 'dark'>(() => (this.mode() === 'system' ? (this.systemDark() ? 'dark' : 'light') : (this.mode() as 'light' | 'dark')));
  constructor() {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      const r = this.resolved();
      this.doc.documentElement.setAttribute('data-theme', r);
      this.doc.documentElement.style.colorScheme = r;
    });
  }
  set(m: ThemeMode) { this.mode.set(m); try { localStorage.setItem(KEY, m); } catch { /* blocked */ } }
  private read(): ThemeMode { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'; } catch { return 'system'; } }
}

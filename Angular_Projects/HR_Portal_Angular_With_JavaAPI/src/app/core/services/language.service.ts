import { Injectable, inject, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { APP, type LangCode } from '../config/app.config';

const KEY = 'hr.lang';
/** Language (en / te / hi) + locale-aware Intl formatting + the flat `ui` phrase dictionary (English phrase -> translation). */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly tr = inject(TranslateService);
  readonly lang = signal<LangCode>('en');
  readonly locale = computed(() => APP.languages.find((l) => l.code === this.lang())?.locale ?? 'en-IN');
  /** currency shown for payroll values (the Java services store amounts without currency) */
  readonly currency = signal('INR');
  private ui: Record<string, string> = {};

  init(): Promise<unknown> {
    let l: LangCode = 'en';
    try { const s = localStorage.getItem(KEY); if (s === 'te' || s === 'hi' || s === 'en') l = s; } catch { /* blocked */ }
    this.tr.addLangs(['en', 'te', 'hi']);
    this.tr.setDefaultLang('en');
    return this.use(l);
  }
  async use(l: LangCode) {
    await new Promise<void>((res) => this.tr.use(l).subscribe({ next: () => res(), error: () => res() }));
    this.ui = (this.tr.instant('ui') as any) ?? {};
    if (typeof this.ui !== 'object') this.ui = {};
    this.lang.set(l);
    try { localStorage.setItem(KEY, l); } catch { /* blocked */ }
    document.documentElement.lang = l;
  }
  /** literal English phrase -> translated phrase (falls back to the phrase) */
  phrase(s: string): string { this.lang(); return this.ui?.[s] ?? s; }

  private nf = new Map<string, Intl.NumberFormat>();
  private fmt(opts: Intl.NumberFormatOptions) { const k = this.locale() + JSON.stringify(opts); let f = this.nf.get(k); if (!f) { f = new Intl.NumberFormat(this.locale(), opts); this.nf.set(k, f); } return f; }
  number(v: number | null | undefined, max = 2) { return v == null ? '—' : this.fmt({ maximumFractionDigits: max }).format(v); }
  money(v: number | null | undefined) { return v == null ? '—' : this.fmt({ style: 'currency', currency: this.currency(), maximumFractionDigits: 2 }).format(v); }
  date(v?: string | Date | null) { if (!v) return '—'; const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v); return isNaN(+d) ? String(v) : new Intl.DateTimeFormat(this.locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(d); }
  dateTime(v?: string | Date | null) { if (!v) return '—'; const d = new Date(v); return isNaN(+d) ? String(v) : new Intl.DateTimeFormat(this.locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d); }
  time(v?: string | Date | null) { if (!v) return '—'; const d = new Date(v); return isNaN(+d) ? String(v) : new Intl.DateTimeFormat(this.locale(), { hour: '2-digit', minute: '2-digit' }).format(d); }
  monthYear(d: Date) { return new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(d); }
  weekday(d: Date, style: 'short' | 'long' = 'short') { return new Intl.DateTimeFormat(this.locale(), { weekday: style }).format(d); }
}

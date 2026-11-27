import { Pipe, type PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/** Locale-aware formatting pipes (impure on purpose: they must re-evaluate when the language signal changes). */
@Pipe({ name: 'fmtDate', standalone: true, pure: false })
export class FmtDatePipe implements PipeTransform { private l = inject(LanguageService); transform(v?: string | Date | null) { this.l.lang(); return this.l.date(v); } }
@Pipe({ name: 'fmtDateTime', standalone: true, pure: false })
export class FmtDateTimePipe implements PipeTransform { private l = inject(LanguageService); transform(v?: string | Date | null) { this.l.lang(); return this.l.dateTime(v); } }
@Pipe({ name: 'fmtNumber', standalone: true, pure: false })
export class FmtNumberPipe implements PipeTransform { private l = inject(LanguageService); transform(v?: number | null, max = 2) { this.l.lang(); return this.l.number(v, max); } }
@Pipe({ name: 'fmtMoney', standalone: true, pure: false })
export class FmtMoneyPipe implements PipeTransform { private l = inject(LanguageService); transform(v?: number | null) { this.l.lang(); return this.l.money(v); } }
/** Translates a literal English UI phrase through the flat `ui` dictionary (falls back to the phrase itself). */
@Pipe({ name: 'ui', standalone: true, pure: false })
export class UiPipe implements PipeTransform { private l = inject(LanguageService); transform(v?: string | null) { return v ? this.l.phrase(v) : ''; } }
@Pipe({ name: 'humanize', standalone: true })
export class HumanizePipe implements PipeTransform { transform(n?: string | null) { return humanize(n ?? ''); } }
export const humanize = (n: string) => n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Id$/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

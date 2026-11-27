import { AfterViewInit, Directive, ElementRef, HostListener, Input, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import type { PermissionKey, RoleKey } from '../../core/models/models';

/** Structural directive: `*appCan="'train:manage'"` renders only when the signed-in role set holds the permission (UI only). */
@Directive({ selector: '[appCan]', standalone: true })
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  readonly appCan = input.required<PermissionKey | PermissionKey[]>();
  readonly appCanRoles = input<RoleKey[] | undefined>(undefined);
  private shown = false;
  constructor() {
    effect(() => {
      const need = [this.appCan()].flat(); const roles = this.appCanRoles();
      const ok = this.auth.can(...need) && (!roles || this.auth.hasRole(...roles));
      if (ok && !this.shown) { this.vcr.createEmbeddedView(this.tpl); this.shown = true; }
      else if (!ok && this.shown) { this.vcr.clear(); this.shown = false; }
    });
  }
}
/** Attribute directive: restrict an input to digits (OTP-like fields: mobile, last 4 card digits, age). */
@Directive({ selector: 'input[appDigitsOnly]', standalone: true })
export class DigitsOnlyDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  @HostListener('input') onInput() { const e = this.el.nativeElement; const clean = e.value.replace(/\D+/g, ''); if (clean !== e.value) { e.value = clean; e.dispatchEvent(new Event('input')); } }
}
/** Attribute directive: upper-case text as the user types (station codes, coach numbers). */
@Directive({ selector: 'input[appUppercase]', standalone: true })
export class UppercaseDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  @HostListener('input') onInput() { const e = this.el.nativeElement; const up = e.value.toUpperCase(); if (up !== e.value) { const pos = e.selectionStart; e.value = up; e.setSelectionRange(pos, pos); e.dispatchEvent(new Event('input')); } }
}
/** Reusable focus behaviour. */
@Directive({ selector: '[appAutofocus]', standalone: true })
export class AutofocusDirective implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  @Input() appAutofocus: boolean | '' = true;
  ngAfterViewInit() { if (this.appAutofocus !== false) setTimeout(() => this.el.nativeElement.focus(), 0); }
}

import { Directive, ElementRef, HostBinding, HostListener, TemplateRef, ViewContainerRef, computed, effect, inject, input, output, afterNextRender, Renderer2, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Role } from '../../core/models';

/** ATTRIBUTE directive with input-based configuration + HostBinding/HostListener: highlights a row on hover. */
@Directive({ selector: '[appHighlight]', standalone: true })
export class HighlightDirective {
  readonly appHighlight = input<string>('rgba(29, 118, 241, 0.10)');
  private readonly hovered = signal(false);
  @HostBinding('style.backgroundColor') get bg() { return this.hovered() ? this.appHighlight() : null; }
  @HostBinding('style.transition') readonly transition = 'background-color .15s';
  @HostListener('mouseenter') on() { this.hovered.set(true); }
  @HostListener('mouseleave') off() { this.hovered.set(false); }
}

/** Focus directive: `<input appFocus>` focuses after the first render (afterNextRender), optional `[appFocus]="condition"`. */
@Directive({ selector: '[appFocus]', standalone: true })
export class FocusDirective {
  readonly appFocus = input<boolean | ''>(true);
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => { if (this.appFocus() !== false) el.nativeElement.focus(); });
  }
}

/** Click-outside directive: emits when a click lands outside the host (menus, popovers, dialogs). */
@Directive({ selector: '[appClickOutside]', standalone: true, host: { '(document:click)': 'onDoc($event)' } })
export class ClickOutsideDirective {
  readonly appClickOutside = output<MouseEvent>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  onDoc(ev: MouseEvent) { if (!this.el.nativeElement.contains(ev.target as Node)) this.appClickOutside.emit(ev); }
}

/** Light tooltip directive (Material's `matTooltip` is used elsewhere – this one shows a custom attribute directive with Renderer2). */
@Directive({ selector: '[appTooltip]', standalone: true })
export class TooltipDirective {
  readonly appTooltip = input.required<string>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly r = inject(Renderer2);
  private tip?: HTMLElement;
  @HostListener('mouseenter') show() {
    this.tip = this.r.createElement('span');
    this.r.setStyle(this.tip, 'cssText', 'position:absolute;z-index:1000;background:#0f172a;color:#fff;padding:4px 8px;border-radius:6px;font-size:12px;pointer-events:none;white-space:nowrap;transform:translateY(-130%)');
    this.r.appendChild(this.tip, this.r.createText(this.appTooltip()));
    this.r.setStyle(this.el.nativeElement, 'position', 'relative');
    this.r.appendChild(this.el.nativeElement, this.tip);
  }
  @HostListener('mouseleave') hide() { if (this.tip) { this.r.removeChild(this.el.nativeElement, this.tip); this.tip = undefined; } }
}

/**
 * STRUCTURAL directive – permission handling: `<button *appHasPermission="'doctors:manage'">`.
 * Re-evaluates reactively through effect() when the signed-in role changes. UI only – the backend enforces authorization.
 */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective {
  readonly appHasPermission = input.required<string>();
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly allowed = computed(() => this.auth.can(this.appHasPermission()));
  constructor() {
    effect(() => {
      this.vcr.clear();
      if (this.allowed()) this.vcr.createEmbeddedView(this.tpl);
    });
  }
}

/** STRUCTURAL directive – role-based visibility: `<div *appRole="['ADMIN','DOCTOR']">…</div>`. */
@Directive({ selector: '[appRole]', standalone: true })
export class RoleDirective {
  readonly appRole = input.required<readonly Role[]>();
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  constructor() {
    effect(() => {
      this.vcr.clear();
      const r = this.auth.role();
      if (r && this.appRole().includes(r)) this.vcr.createEmbeddedView(this.tpl);
    });
  }
}

/** Directive composition API: a single `appInteractive` host directive bundling highlight + a11y button behaviour for clickable rows/cards. */
@Directive({ selector: '[appInteractive]', standalone: true, hostDirectives: [{ directive: HighlightDirective, inputs: ['appHighlight: appInteractiveColor'] }], host: { role: 'button', tabindex: '0', '[style.cursor]': '"pointer"' } })
export class InteractiveDirective {}

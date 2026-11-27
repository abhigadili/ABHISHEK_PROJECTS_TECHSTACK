import {
  Directive,
  ElementRef,
  HostListener,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import { Permission, Role } from '../../core/models/auth.models';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Structural directive: `<button *appHasRole="['HR_ADMIN','SUPER_ADMIN']">`.
 * Renders the template only for the listed roles and reacts to role changes (login/logout) via a signal effect.
 * UI convenience only — the backend still rejects unauthorised calls.
 */
@Directive({ selector: '[appHasRole]', standalone: true })
export class HasRoleDirective {
  readonly appHasRole = input.required<readonly Role[]>();

  private readonly permissions = inject(PermissionService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  constructor() {
    effect(() => {
      const allowed = this.permissions.hasRole(this.appHasRole());
      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}

/** Structural directive: `<a *appHasPermission="'leave.approve'">` (a single permission or any-of list). */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective {
  readonly appHasPermission = input.required<Permission | readonly Permission[]>();

  private readonly permissions = inject(PermissionService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  constructor() {
    effect(() => {
      const wanted = this.appHasPermission();
      const list = (Array.isArray(wanted) ? wanted : [wanted]) as readonly Permission[];
      const allowed = this.permissions.hasAny(list);
      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}

/** Attribute directive: focuses the host once it is rendered (login email, dialog first field). */
@Directive({ selector: '[appAutofocus]', standalone: true })
export class AutofocusDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.el.nativeElement.focus());
  }
}

/** Attribute directive: highlights the host on hover with a configurable colour (`[appHighlight]="'#e3f2fd'"`). */
@Directive({
  selector: '[appHighlight]',
  standalone: true,
  host: { '[style.backgroundColor]': 'active ? colour() : null', '[style.transition]': '"background-color .15s"' },
})
export class HighlightDirective {
  readonly colour = input<string>('rgba(63, 81, 181, 0.08)', { alias: 'appHighlight' });
  protected active = false;

  @HostListener('mouseenter') onEnter(): void {
    this.active = true;
  }

  @HostListener('mouseleave') onLeave(): void {
    this.active = false;
  }
}

/** Attribute directive for `<input>`: strips every non-digit character as the user types or pastes. */
@Directive({ selector: 'input[appNumbersOnly]', standalone: true })
export class NumbersOnlyDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @HostListener('input') onInput(): void {
    const input = this.el.nativeElement;
    const cleaned = input.value.replace(/\D+/g, '');
    if (cleaned !== input.value) {
      input.value = cleaned;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/models';

/** *appHasRole="['ADMIN','SUPER_ADMIN']" : renders the element only for users holding one of the roles (UI convenience; the API enforces it anyway). */
@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective {
  private auth = inject(AuthService);
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  private roles: Role[] = [];
  @Input() set appHasRole(r: Role[]) { this.roles = r; this.render(); }
  constructor() { effect(() => { this.auth.roles(); this.render(); }); }
  private render() {
    this.vcr.clear();
    if (this.auth.hasRole(...this.roles)) this.vcr.createEmbeddedView(this.tpl);
  }
}

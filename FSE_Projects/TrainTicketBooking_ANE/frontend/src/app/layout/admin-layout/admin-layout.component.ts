import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectNavLinks } from '../../core/config/tokens';
import { ShellComponent } from '../shell.component';
@Component({ selector: 'app-admin-layout', imports: [ShellComponent], changeDetection: ChangeDetectionStrategy.OnPush, template: `<app-shell [links]="links" heading="Back office" />` })
export class AdminLayoutComponent { readonly links = injectNavLinks('admin'); }

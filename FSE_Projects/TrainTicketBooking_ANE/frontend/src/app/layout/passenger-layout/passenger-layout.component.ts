import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectNavLinks } from '../../core/config/tokens';
import { ShellComponent } from '../shell.component';
@Component({ selector: 'app-passenger-layout', imports: [ShellComponent], changeDetection: ChangeDetectionStrategy.OnPush, template: `<app-shell [links]="links" heading="My RailBook" />` })
export class PassengerLayoutComponent { readonly links = injectNavLinks('passenger'); }

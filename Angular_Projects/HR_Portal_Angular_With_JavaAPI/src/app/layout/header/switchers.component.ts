import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { APP, type LangCode } from '../../core/config/app.config';
import { LanguageService } from '../../core/services/language.service';
import { ThemeService, type ThemeMode } from '../../core/services/theme.service';

@Component({
  selector: 'app-language-switcher', standalone: true, imports: [MatMenuModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="btn-hr ghost sm" [matMenuTriggerFor]="m" aria-label="Language"><i class="pi pi-globe"></i><span>{{ current() }}</span></button>
    <mat-menu #m="matMenu">@for (l of langs; track l.code) { <button mat-menu-item (click)="svc.use($any(l.code))"><i class="pi me-2" [class.pi-check]="svc.lang() === l.code"></i>{{ l.label }}</button> }</mat-menu>`,
})
export class LanguageSwitcherComponent { svc = inject(LanguageService); langs = APP.languages; current = () => this.langs.find((l) => l.code === this.svc.lang())?.label; void0?: LangCode; }

@Component({
  selector: 'app-theme-switcher', standalone: true, imports: [MatMenuModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="btn-hr ghost icon" [matMenuTriggerFor]="m" aria-label="Theme"><i class="pi" [class.pi-sun]="theme.resolved() === 'light'" [class.pi-moon]="theme.resolved() === 'dark'"></i></button>
    <mat-menu #m="matMenu">@for (o of opts; track o.v) { <button mat-menu-item (click)="theme.set(o.v)"><i class="pi me-2" [class]="o.icon"></i>{{ 'common.' + o.v | translate }}@if (theme.mode() === o.v) { <i class="pi pi-check ms-2"></i> }</button> }</mat-menu>`,
})
export class ThemeSwitcherComponent {
  theme = inject(ThemeService);
  opts: { v: ThemeMode; icon: string }[] = [{ v: 'light', icon: 'pi-sun' }, { v: 'dark', icon: 'pi-moon' }, { v: 'system', icon: 'pi-desktop' }];
}

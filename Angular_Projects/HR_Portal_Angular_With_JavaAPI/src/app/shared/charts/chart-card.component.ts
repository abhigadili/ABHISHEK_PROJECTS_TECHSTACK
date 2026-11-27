import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { ThemeService } from '../../core/services/theme.service';
import { CardComponent, EmptyStateComponent, ErrorStateComponent, LoadingBlockComponent } from '../components/ui.components';

/** Card with loading / error / empty states around a responsive, interactive ECharts chart (ECharts is lazy-loaded). */
@Component({
  selector: 'app-chart-card', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, CardComponent, EmptyStateComponent, ErrorStateComponent, LoadingBlockComponent],
  template: `<app-card [title]="title()" class="d-block h-100"><span actions><ng-content select="[actions]" /></span>
    @if (loading()) { <app-loading-block [rows]="5" /> } @else if (error()) { <app-error-state [error]="error()" (retry)="retry()" /> } @else if (empty()) { <app-empty-state /> }
    @else { <div echarts [options]="option()!" [style.height.px]="height()" style="width:100%;min-width:0" role="img" [attr.aria-label]="title()"></div> }</app-card>`,
  styles: [`:host { display: block; height: 100%; } :host ::ng-deep .hr-card { height: 100%; }`],
})
export class ChartCardComponent {
  title = input.required<string>(); loading = input(false); error = input<unknown>(); empty = input(false); height = input(260);
  build = input.required<(dark: boolean) => EChartsCoreOption>(); retryFn = input<() => void>();
  private theme = inject(ThemeService);
  option = computed(() => (this.empty() || this.loading() ? null : this.build()(this.theme.resolved() === 'dark')));
  retry() { this.retryFn()?.(); }
}

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { PageMeta } from '../../core/models/api.models';
import { APP_CONFIG } from '../../core/tokens/tokens';

/** Stand-alone pagination bar for non-table lists (cards, notifications). Pure presentation: emits 1-based pages. */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [MatPaginatorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta().total > 0) {
      <mat-paginator [length]="meta().total" [pageIndex]="meta().page - 1" [pageSize]="meta().limit" [pageSizeOptions]="sizes" (page)="onPage($event)" showFirstLastButtons />
    }
  `,
})
export class PaginationComponent {
  protected readonly sizes = inject(APP_CONFIG).pageSizeOptions as number[];
  readonly meta = input.required<PageMeta>();
  readonly pageChange = output<{ page: number; limit: number }>();

  protected onPage(e: PageEvent): void {
    this.pageChange.emit({ page: e.pageIndex + 1, limit: e.pageSize });
  }
}

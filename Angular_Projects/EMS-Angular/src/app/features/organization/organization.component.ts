import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, distinctUntilChanged, filter, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { AppError } from '../../core/models/api.models';
import { OrgChart, OrgNode, OrgSearchHit } from '../../core/models/organization.models';
import { OrganizationService } from '../../core/services/organization.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { EmptyStateComponent, ErrorMessageComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { OrgNodeComponent } from './org-node.component';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';

type ChartState = { chart: OrgChart | null; error: AppError | null; loading: boolean };

/** Flatten helper — used to open the first levels by default and to find a node's ancestors without another request. */
function walk(nodes: OrgNode[], visit: (n: OrgNode, depth: number, parents: number[]) => void, depth = 0, parents: number[] = []): void {
  for (const n of nodes) {
    visit(n, depth, parents);
    walk(n.subordinates, visit, depth + 1, [...parents, n.id]);
  }
}

/**
 * Organization chart. Every person and every reporting line comes from the backend (/org-chart*).
 *   filters (department, subtree root) ─▶ chart request (switchMap)
 *   :employeeId route param ─▶ selected employee ─▶ reporting chain + direct reports (forkJoin)
 *   search box ─▶ debounce ─▶ switchMap ─▶ /org-chart/search ─▶ pick a hit ─▶ navigate (selection + expand its ancestors)
 */
@Component({
  selector: 'app-organization',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule,
    OrgNodeComponent, EmployeeSelectComponent, PageHeaderComponent, ErrorMessageComponent, EmptyStateComponent, ProfilePictureComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Organization chart" subtitle="Reporting structure, live from the employee hierarchy" />

      <div class="panel toolbar-row">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-label>Find a person</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="searchControl" [matAutocomplete]="auto" data-testid="org-search" />
          <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pick($event.option.value)" [displayWith]="displayHit">
            @for (h of hits(); track h.id) {
              <mat-option [value]="h">{{ h.name }} <small>· {{ h.jobTitle || h.designation }} · {{ h.department?.name }}</small></mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Department</mat-label>
          <mat-select [value]="departmentId()" (selectionChange)="departmentId.set($event.value)" data-testid="org-department">
            <mat-option [value]="null">All departments</mat-option>
            @for (d of departments(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="root-select"><app-employee-select label="Show team of (manager)" [formControl]="rootControl" /></div>
        <button mat-button type="button" (click)="expandAll()"><mat-icon>unfold_more</mat-icon> Expand all</button>
        <button mat-button type="button" (click)="collapseAll()"><mat-icon>unfold_less</mat-icon> Collapse all</button>
      </div>

      <app-error-message [error]="state().error" (retry)="reload()" />

      <div class="layout">
        <section class="panel tree" aria-label="Organization tree">
          @if (state().chart; as chart) {
            @if (chart.roots.length) {
              <ul role="tree" data-testid="org-tree">
                @for (r of chart.roots; track r.id) {
                  <app-org-node [node]="r" [expandedIds]="expanded()" [selectedId]="selectedId()" [highlightPath]="path()" (toggled)="toggle($event)" (picked)="open($event)" />
                }
              </ul>
              <p class="muted total">{{ chart.totalNodes }} people shown</p>
              @if (chart.warnings; as w) {
                <p class="warn" role="alert">{{ w.reason }}: {{ w.unreachableEmployees.length }} employee(s) not shown.</p>
              }
            } @else {
              <app-empty-state icon="account_tree" title="No one to show" message="No employees match this filter." />
            }
          } @else if (state().loading) {
            <p class="muted">Loading organization…</p>
          }
        </section>

        <aside class="panel detail" aria-live="polite">
          @if (detail(); as d) {
            <div class="head">
              <app-profile-picture [employeeId]="d.employee.id" [hasPicture]="!!d.employee.profilePictureUrl" [name]="d.employee.name" [size]="64" />
              <div>
                <h2 data-testid="org-selected-name">{{ d.employee.name }}</h2>
                <div>{{ d.employee.jobTitle || d.employee.designation || '—' }}</div>
                <div class="muted">{{ d.employee.department?.name ?? 'No department' }}</div>
              </div>
            </div>
            <a mat-flat-button [routerLink]="['/employees', d.employee.id]" data-testid="org-open-employee">Open employee</a>
            <h3>Reporting chain</h3>
            @if (d.chain.length) {
              <ol class="chain" data-testid="org-chain">
                @for (c of d.chain; track c.id) {
                  <li><a [routerLink]="['/organization', c.id]">{{ c.name }}</a> <span class="muted">· {{ c.jobTitle || c.designation }}</span></li>
                }
              </ol>
            } @else {
              <p class="muted">Top of the organization.</p>
            }
            <h3>Direct reports ({{ d.reports.length }})</h3>
            <ul class="reports" data-testid="org-reports">
              @for (r of d.reports; track r.id) {
                <li><a [routerLink]="['/organization', r.id]">{{ r.name }}</a> <span class="muted">· {{ r.jobTitle || r.designation }}</span></li>
              } @empty {
                <li class="muted">No direct reports.</li>
              }
            </ul>
          } @else {
            <app-empty-state icon="touch_app" title="Select a person" message="Click anyone in the tree to see their reporting chain and direct reports." />
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .toolbar-row { margin-bottom: 16px; }
    .search { flex: 1 1 260px; min-width: 240px; }
    .root-select { flex: 1 1 260px; min-width: 240px; margin-bottom: -22px; }
    .layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr); gap: 16px; align-items: start; }
    .tree { max-height: 72vh; overflow: auto; }
    .tree ul[role='tree'] { padding: 0; margin: 0; }
    .detail { position: sticky; top: 80px; }
    .head { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
    h2 { margin: 0; font-weight: 500; font-size: 1.2rem; }
    h3 { margin: 18px 0 6px; font-weight: 500; font-size: 1rem; }
    .chain, .reports { margin: 0; padding-left: 20px; }
    .total { margin: 12px 0 0; font-size: 12px; }
    .warn { color: #b06000; font-size: 13px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .detail { position: static; } }
  `,
})
export class OrganizationComponent implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly viewReady = signal(false);
  private readonly org = inject(OrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reference = inject(ReferenceDataService);

  protected readonly departments = toSignal(this.reference.departments(), { initialValue: [] });
  protected readonly departmentId = signal<number | null>(null);
  protected readonly rootControl = new FormControl<number | null>(null);
  private readonly rootId = toSignal(this.rootControl.valueChanges.pipe(startWith(null)), { initialValue: null });
  private readonly reloadTick = signal(0);

  /** :employeeId from the URL (Observable → signal): the single source of truth for the selection. */
  protected readonly selectedId = toSignal(
    this.route.paramMap.pipe(map((p) => (p.get('employeeId') ? Number(p.get('employeeId')) : null))),
    { initialValue: null },
  );

  protected readonly state = toSignal(
    toObservable(computed(() => ({ dept: this.departmentId(), root: this.rootId(), tick: this.reloadTick() }))).pipe(
      switchMap(({ dept, root }) =>
        (root ? this.org.subtree(root) : this.org.chart(dept)).pipe(
          map((chart): ChartState => ({ chart, error: null, loading: false })),
          catchError((error: AppError) => of<ChartState>({ chart: null, error, loading: false })),
          startWith<ChartState>({ chart: null, error: null, loading: true }),
        ),
      ),
    ),
    { initialValue: { chart: null, error: null, loading: true } as ChartState },
  );

  // ----- expand / collapse -----
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());
  /** ids of the selected employee's ancestors — highlighted so the path from the top is visible */
  protected readonly path = signal<ReadonlySet<number>>(new Set());

  /** The reporting chain and direct reports of the selection, fetched together (forkJoin) and cancelled on reselection. */
  protected readonly detail = toSignal(
    toObservable(this.selectedId).pipe(
      switchMap((id) =>
        id
          ? forkJoin({ chain: this.org.reportingChain(id), reports: this.org.directReports(id) }).pipe(
              map(({ chain, reports }) => ({ employee: chain.employee, chain: chain.chain, reports })),
              catchError(() => of(null)),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  // ----- search -----
  protected readonly searchControl = new FormControl<string | OrgSearchHit>('', { nonNullable: true });
  protected readonly hits = toSignal(
    this.searchControl.valueChanges.pipe(
      filter((v): v is string => typeof v === 'string'),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => (q.trim().length >= 2 ? this.org.search(q, this.rootId()).pipe(catchError(() => of([] as OrgSearchHit[]))) : of([] as OrgSearchHit[]))),
    ),
    { initialValue: [] as OrgSearchHit[] },
  );
  protected readonly displayHit = (v: string | OrgSearchHit | null): string => (typeof v === 'string' ? v : (v?.name ?? ''));

  /** The tree only exists in the DOM after the view is initialised; from then on selections can be scrolled into view. */
  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  constructor() {
    // Scroll the selected person into view once the view exists and after each render that shows them.
    effect(() => {
      const id = this.selectedId();
      this.state(); // re-run when a new chart arrives (deep link: /organization/:id)
      this.expanded();
      if (!this.viewReady() || !id) return;
      afterNextRender(() => this.host.nativeElement.querySelector(`[data-testid="org-node-${id}"]`)?.scrollIntoView({ block: 'nearest' }), { injector: this.injector });
    });

    // Side effects (not derived state): open the first two levels whenever a new chart arrives.
    effect(() => {
      const chart = this.state().chart;
      if (!chart) return;
      untracked(() => {
        const open = new Set<number>();
        walk(chart.roots, (n, depth) => { if (depth < 2 && n.subordinates.length) open.add(n.id); });
        this.expanded.set(open);
      });
    });

    // Selection changes: expand the ancestors in the loaded tree and highlight the path.
    effect(() => {
      const id = this.selectedId();
      const chart = this.state().chart;
      untracked(() => {
        if (!id || !chart) {
          this.path.set(new Set());
          return;
        }
        let found: number[] | null = null;
        walk(chart.roots, (n, _d, parents) => { if (n.id === id) found = parents; });
        const parents = found as number[] | null;
        this.path.set(new Set(parents ?? []));
        if (parents?.length) this.expanded.update((s) => new Set([...s, ...parents]));
      });
    });
  }

  protected toggle(id: number): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected expandAll(): void {
    const all = new Set<number>();
    walk(this.state().chart?.roots ?? [], (n) => { if (n.subordinates.length) all.add(n.id); });
    this.expanded.set(all);
  }

  protected collapseAll(): void {
    this.expanded.set(new Set());
  }

  protected open(id: number): void {
    void this.router.navigate(['/organization', id]);
  }

  protected pick(hit: OrgSearchHit): void {
    // Make sure the hit's ancestors are open even if the hit sits outside the loaded depth.
    this.expanded.update((s) => new Set([...s, ...hit.managerChainIds]));
    this.open(hit.id);
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
  }
}

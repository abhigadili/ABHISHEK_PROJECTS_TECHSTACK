import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { RefService } from '../../shared/components/ref.service';
import { addRecentSearch, uiStore } from '../../state/zustand-style/ui.store';
import { RecentActions } from '../../state/ngrx/recent.state';
import { Store } from '@ngrx/store';

/** Global search over employees (directory), departments, projects, customers - all via backend list / search endpoints. */
@Component({
  selector: 'app-global-search', standalone: true, imports: [FormsModule, TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="position-relative" style="flex:1 1 auto;max-width:420px;min-width:160px">
    <i class="pi pi-search position-absolute text-muted" style="left:12px;top:50%;transform:translateY(-50%);font-size:13px"></i>
    <input #box class="form-control" style="padding-left:34px;width:100%" type="search" [ngModel]="q()" (ngModelChange)="q.set($event); open.set(true)" (focus)="open.set(true)" [placeholder]="'nav.search' | translate" [attr.aria-label]="'common.search' | translate" />
    @if (open()) {
      <div class="hr-card position-absolute start-0 end-0 overflow-auto py-1" style="top:44px;z-index:1200;max-height:60vh">
        @if (!on()) { @for (r of recent(); track r) { <button type="button" class="d-block w-100 border-0 bg-transparent px-3 py-1 text-start hit" (click)="q.set(r)">{{ r }}</button> } @empty { <div class="px-3 py-3 text-muted" style="font-size:12px">{{ 'common.typeToSearch' | translate }}</div> } }
        @else {
          @for (h of hits(); track h.key) { <button type="button" class="d-flex w-100 align-items-center gap-2 border-0 bg-transparent px-3 py-1 text-start hit" (click)="go(h)"><i class="pi text-muted" [class]="h.icon" style="font-size:13px"></i><span class="text-truncate">{{ h.label }}</span><span class="ms-auto text-muted text-truncate" style="font-size:11px">{{ h.sub }}</span></button> }
          @if (!hits().length && !busy()) { <div class="px-3 py-3 text-muted" style="font-size:12px">{{ 'common.noData' | translate }}</div> } }
      </div>
    }</div>`,
  styles: [`.hit { font-size: 13px; } .hit:hover { background: var(--hr-surface-2); }`],
})
export class GlobalSearchComponent {
  private router = inject(Router); private perm = inject(PermissionService); private refs = inject(RefService); private store = inject(Store); private host = inject(ElementRef);
  box = viewChild<ElementRef<HTMLInputElement>>('box');
  q = signal(''); open = signal(false);
  private dq = toSignal(toObservable(computed(() => this.q().trim())).pipe(debounceTime(300)), { initialValue: '' });
  on = computed(() => this.dq().length >= 2);
  recent = uiStore.select((s) => s.recentSearches);
  private emp = injectOp<any>('employee.directory', () => ({ query: { q: this.dq(), size: 5 } }), () => ({ enabled: this.on() }));
  private proj = injectOp<any>('project.list', () => ({ query: { q: this.dq(), size: 5 } }), () => ({ enabled: this.on() && this.perm.canCall('project.list') }));
  private cust = injectOp<any>('project.listCustomers', () => ({ query: { q: this.dq(), size: 5 } }), () => ({ enabled: this.on() && this.perm.canCall('project.listCustomers') }));
  busy = computed(() => this.emp.isFetching() || this.proj.isFetching());
  hits = computed(() => {
    if (!this.on()) return [];
    const t = this.dq().toLowerCase();
    const deps = this.refs.options('department')().filter((o) => o.label.toLowerCase().includes(t)).slice(0, 4);
    return [
      ...(this.emp.data()?.content ?? []).map((e: any) => ({ key: 'e' + e.id, icon: 'pi-user', label: e.fullName, sub: e.employeeCode, to: `/employees/${e.id}`, kind: 'employee' })),
      ...deps.map((d) => ({ key: 'd' + d.value, icon: 'pi-building', label: d.label, sub: '', to: '/organization', kind: '' })),
      ...(this.proj.data()?.content ?? []).map((p: any) => ({ key: 'p' + p.id, icon: 'pi-folder-open', label: p.name, sub: p.code, to: `/projects/${p.id}`, kind: 'project' })),
      ...(this.cust.data()?.content ?? []).map((c: any) => ({ key: 'c' + c.id, icon: 'pi-briefcase', label: c.name, sub: c.code, to: `/customers/${c.id}`, kind: 'customer' })),
    ];
  });
  go(h: { to: string; label: string; key: string; kind: string }) {
    addRecentSearch(this.dq());
    if (h.kind) this.store.dispatch(RecentActions.visited({ record: { id: h.key, kind: h.kind as any, title: h.label, link: h.to, at: Date.now() } }));
    this.open.set(false); this.q.set(''); this.router.navigateByUrl(h.to);
  }
  @HostListener('document:mousedown', ['$event']) outside(e: MouseEvent) { if (!this.host.nativeElement.contains(e.target)) this.open.set(false); }
  @HostListener('window:keydown', ['$event']) key(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.box()?.nativeElement.focus(); } }
}

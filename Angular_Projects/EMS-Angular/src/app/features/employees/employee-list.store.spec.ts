import { TestBed } from '@angular/core/testing';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { EmployeeListStore } from './employee-list.store';

const params = (o: Partial<Parameters<EmployeeListStore['applyParams']>[0]> = {}) => ({
  q: '', departmentId: null, designationId: null, status: 'ACTIVE' as const, employmentType: null, sort: 'name:asc', limit: 10, page: 1, ...o,
});
const person = (id: number) => ({ id, fullName: `P${id}` });

describe('EmployeeListStore (signals: linkedSignal / computed / toSignal)', () => {
  let store: EmployeeListStore;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideTestApp(), EmployeeListStore] });
    store = TestBed.inject(EmployeeListStore);
  });
  afterEach(() => http().verify());

  const flush = (ids: number[], total = ids.length) => {
    TestBed.flushEffects();
    const req = http().expectOne((r) => r.url.endsWith('/employees'));
    req.flush(envelope(ids.map(person), meta(total)));
    return req.request;
  };

  it('loads the first page with default criteria and exposes loading → ready', () => {
    TestBed.flushEffects();
    expect(store.loading()).toBeTrue();
    flush([1, 2, 3]);
    expect(store.loading()).toBeFalse();
    expect(store.items().map((e) => e.id)).toEqual([1, 2, 3]);
    expect(store.meta()?.total).toBe(3);
  });

  it('linkedSignal: changing any criterion resets the page to 1, but a page change alone keeps criteria', () => {
    TestBed.flushEffects();
    flush([1]);
    store.applyParams(params({ page: 3 }));
    expect(store.page()).toBe(3);
    const r1 = flush([1]);
    expect(r1.params.get('page')).toBe('3');
    store.applyParams(params({ page: 3, q: 'eve' })); // criteria changed ⇒ page falls back to 1 … but URL says 3
    expect(store.criteria().q).toBe('eve');
    expect(store.page()).toBe(3); // explicit page from the URL is applied after the reset
    flush([2]);
    store.criteria.update((c) => ({ ...c, q: 'bob' })); // a pure criteria change from elsewhere resets paging
    expect(store.page()).toBe(1);
    flush([3]);
  });

  it('applyParams is idempotent: identical params do not trigger a second request', () => {
    TestBed.flushEffects();
    flush([1]);
    store.applyParams(params());
    store.applyParams(params());
    TestBed.flushEffects();
    http().expectNone((r) => r.url.endsWith('/employees'));
  });

  it('selection is a linkedSignal: kept while the person is in the results, cleared when they disappear', () => {
    TestBed.flushEffects();
    flush([1, 2, 3]);
    store.selectedId.set(2);
    expect(store.selected()?.fullName).toBe('P2');
    store.applyParams(params({ q: 'x' }));
    flush([2, 9]); // still contains 2 → selection survives
    expect(store.selectedId()).toBe(2);
    store.applyParams(params({ q: 'y' }));
    flush([7, 8]); // 2 vanished → selection cleared
    expect(store.selectedId()).toBeNull();
    expect(store.selected()).toBeNull();
  });

  it('switchMap cancels the in-flight request when criteria change', () => {
    TestBed.flushEffects();
    const first = http().expectOne((r) => r.url.endsWith('/employees'));
    store.applyParams(params({ q: 'a' }));
    TestBed.flushEffects();
    expect(first.cancelled).toBeTrue();
    flush([5]);
    expect(store.items().map((e) => e.id)).toEqual([5]);
  });

  it('errors become state (not exceptions) and hasActiveFilters is derived', () => {
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/employees')).flush({ success: false, error: { code: 'FORBIDDEN', message: 'nope' } }, { status: 403, statusText: 'Forbidden' });
    expect(store.error()?.message).toBe('nope');
    expect(store.hasActiveFilters()).toBeFalse();
    store.applyParams(params({ departmentId: 2 }));
    expect(store.hasActiveFilters()).toBeTrue();
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/employees')).flush(envelope([], meta(0)));
  });
});

import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelope, http, meta, provideTestApp } from '../../../testing/test-helpers';
import { OrganizationComponent } from './organization.component';
import { organizationMatcher } from './organization.routes';

const node = (id: number, name: string, subs: unknown[] = []) => ({ id, employeeCode: `E${id}`, name, workEmail: `${name}@x.y`, designation: null, jobTitle: `${name} title`, department: { id: 1, name: 'Eng' }, managerId: null, profilePictureUrl: null, directReportCount: subs.length, subordinates: subs });
const chart = { roots: [node(1, 'Root', [node(2, 'Mid', [node(3, 'Leaf')]), node(4, 'Other')])], totalNodes: 4 };

describe('OrganizationComponent (recursive tree from backend data)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideTestApp({ extra: [provideRouter([{ path: 'organization', children: [{ matcher: organizationMatcher, component: OrganizationComponent }] }])] }) });
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http().verify());

  const open = async (url: string) => {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    http().expectOne((r) => r.url.endsWith('/departments')).flush(envelope([{ id: 1, name: 'Eng' }], meta(1)));
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/org-chart')).flush(envelope(chart));
    TestBed.flushEffects();
    harness.detectChanges();
  };
  const names = () => harness.fixture.debugElement.queryAll(By.css('.person strong')).map((e) => e.nativeElement.textContent.trim());

  it('the URL matcher serves both /organization and /organization/:id (and rejects junk)', () => {
    expect(organizationMatcher([] as never)).toEqual({ consumed: [] });
    expect(organizationMatcher([{ path: '42' }] as never)?.posParams?.['employeeId'].path).toBe('42');
    expect(organizationMatcher([{ path: 'abc' }] as never)).toBeNull();
  });

  it('renders the hierarchy returned by the API, with the first two levels expanded by default', async () => {
    await open('/organization');
    expect(names()).toEqual(['Root', 'Mid', 'Leaf', 'Other']); // depth 0 and 1 are open, so their children (depth ≤ 2) are visible
    expect(harness.fixture.nativeElement.textContent).toContain('4 people shown');
  });

  it('expand / collapse is driven by signal state', async () => {
    await open('/organization');
    (harness.fixture.debugElement.query(By.css('[aria-label="Collapse Mid"]')).nativeElement as HTMLButtonElement).click();
    harness.detectChanges();
    expect(names()).toEqual(['Root', 'Mid', 'Other']); // Leaf hidden
    (harness.fixture.debugElement.query(By.css('[aria-label="Expand Mid"]')).nativeElement as HTMLButtonElement).click();
    harness.detectChanges();
    expect(names()).toContain('Leaf');
    (harness.fixture.debugElement.query(By.css('[aria-label="Collapse Root"]')).nativeElement as HTMLButtonElement).click();
    harness.detectChanges();
    expect(names()).toEqual(['Root']);
  });

  it('selecting a person (route param) highlights them, expands their ancestors and loads chain + direct reports together', async () => {
    await harness.navigateByUrl('/organization/3');
    harness.detectChanges();
    http().expectOne((r) => r.url.endsWith('/departments')).flush(envelope([], meta(0)));
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/org-chart')).flush(envelope(chart));
    // forkJoin: both detail requests are issued immediately
    const chainReq = http().expectOne((r) => r.url.endsWith('/org-chart/employees/3/reporting-chain'));
    const reportsReq = http().expectOne((r) => r.url.endsWith('/org-chart/employees/3/direct-reports'));
    chainReq.flush(envelope({ employee: node(3, 'Leaf'), chain: [{ level: 1, ...node(2, 'Mid') }, { level: 2, ...node(1, 'Root') }] }));
    reportsReq.flush(envelope([]));
    TestBed.flushEffects();
    harness.detectChanges();
    expect(harness.fixture.debugElement.query(By.css('[data-testid="org-node-3"].selected'))).not.toBeNull();
    expect(names()).toContain('Leaf'); // ancestors auto-expanded
    expect(harness.fixture.debugElement.query(By.css('[data-testid="org-chain"]')).nativeElement.textContent).toContain('Mid');
    expect(harness.fixture.debugElement.query(By.css('[data-testid="org-selected-name"]')).nativeElement.textContent).toBe('Leaf');
  });

  it('a backend error is shown with a retry, not an empty chart', async () => {
    await harness.navigateByUrl('/organization');
    harness.detectChanges();
    http().expectOne((r) => r.url.endsWith('/departments')).flush(envelope([], meta(0)));
    TestBed.flushEffects();
    http().expectOne((r) => r.url.endsWith('/org-chart')).flush({ success: false, error: { code: 'FORBIDDEN', message: 'Chart unavailable' } }, { status: 403, statusText: 'Forbidden' }); // (5xx would be retried with back-off)
    harness.detectChanges();
    expect(harness.fixture.nativeElement.textContent).toContain('Chart unavailable');
  });
});

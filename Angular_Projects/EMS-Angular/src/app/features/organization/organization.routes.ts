import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

/**
 * Custom UrlMatcher: one route serves both `/organization` and `/organization/:employeeId`, so changing the selected
 * person only changes route params — the same OrganizationComponent instance (and its loaded tree) is reused.
 */
export function organizationMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 1 && /^\d+$/.test(segments[0].path)) {
    return { consumed: segments, posParams: { employeeId: segments[0] } };
  }
  return null;
}

export const ORGANIZATION_ROUTES: Routes = [
  {
    matcher: organizationMatcher,
    title: 'Organization chart',
    loadComponent: () => import('./organization.component').then((m) => m.OrganizationComponent),
  },
];

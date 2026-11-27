import { getRouterSelectors } from '@ngrx/router-store';

/** Router Store selectors: read route params / query params / data from the store instead of ActivatedRoute. */
export const { selectCurrentRoute, selectRouteParams, selectRouteParam, selectQueryParam, selectQueryParams, selectRouteData, selectUrl } = getRouterSelectors();

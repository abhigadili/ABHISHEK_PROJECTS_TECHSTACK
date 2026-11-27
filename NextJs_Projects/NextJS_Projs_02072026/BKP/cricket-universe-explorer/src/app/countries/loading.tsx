/**
 * ============================================================
 * app/countries/loading.tsx — Countries Segment Loading UI
 * ============================================================
 *
 * SEGMENT-SCOPED LOADING STATE:
 *   This loading.tsx is scoped to the /countries route segment.
 *   It wraps app/countries/page.tsx (and its sub-routes) in a
 *   Suspense boundary.
 *
 *   When a user navigates to /countries, this spinner is shown
 *   WHILE the countries page fetches data. When the data resolves,
 *   the real page content replaces the spinner.
 *
 * HOW MULTIPLE LOADING FILES STACK:
 *   - app/loading.tsx         → root segment
 *   - app/countries/loading.tsx → /countries/* segment (this file)
 *
 *   The countries loading.tsx takes priority over the root loading.tsx
 *   when rendering /countries routes.
 *
 * SAME SPINNER, DIFFERENT SCOPE:
 *   We reuse the same Loading component here. In a real app you
 *   might use a skeleton that matches the countries grid layout
 *   (see LoadingCard in Loading.tsx) to reduce layout shift.
 * ============================================================
 */

import Loading from '@/components/ui/Loading'

/**
 * Loading state for the /countries route segment.
 * Shown while the countries page data-fetches on the server.
 */
export default function CountriesLoading() {
  return <Loading />
}

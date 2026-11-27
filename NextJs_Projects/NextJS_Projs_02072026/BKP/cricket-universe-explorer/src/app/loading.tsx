/**
 * ============================================================
 * app/loading.tsx — Root Loading UI
 * ============================================================
 *
 * HOW LOADING UI WORKS IN NEXT.JS APP ROUTER:
 *   Next.js automatically wraps each route segment in a React
 *   Suspense boundary. The contents of loading.tsx are rendered
 *   IMMEDIATELY as the "fallback" prop of that Suspense boundary.
 *
 *   This means:
 *   1. The static HTML shell (Navbar, Footer, loading spinner)
 *      is sent to the browser instantly.
 *   2. The actual page.tsx content streams in when the async
 *      Server Component finishes data-fetching.
 *   3. The spinner is replaced by the real content seamlessly.
 *
 *   This is fundamentally different from the old pages/ router
 *   where you'd show a blank page until getServerSideProps resolved.
 *
 * ROOT SCOPE:
 *   This file at app/loading.tsx covers the root layout segment.
 *   Sub-directories can have their own loading.tsx for more
 *   granular loading states (e.g., app/countries/loading.tsx
 *   shows a spinner only for the countries segment).
 *
 * WHY IMPORT A COMPONENT RATHER THAN INLINE JSX?
 *   The Loading component in @/components/ui/Loading is reused
 *   across multiple loading.tsx files. DRY principle — one source
 *   of truth for the spinner design.
 * ============================================================
 */

import Loading from '@/components/ui/Loading'

/**
 * Root loading state — rendered while any async Server Component
 * in the root layout segment is awaiting data.
 *
 * Imports and delegates to the Loading component so the spinner
 * design is defined in one place and reused here and in
 * app/countries/loading.tsx.
 */
export default function RootLoading() {
  return <Loading />
}

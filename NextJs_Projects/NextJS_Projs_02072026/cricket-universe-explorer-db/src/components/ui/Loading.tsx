/**
 * ============================================================
 * Loading.tsx — Loading spinner and skeleton placeholder components
 * ============================================================
 *
 * This file exports TWO components:
 *
 * 1. DEFAULT export `Loading`
 *    Full-page loading state — shown while a route or data fetch is
 *    pending. Uses a spinning cricket ball emoji animated with
 *    Tailwind's `animate-spin` utility.
 *
 * 2. NAMED export `LoadingCard`
 *    Skeleton card placeholder — mimics the shape of a content card
 *    using grey blocks animated with `animate-pulse`. Shown in lists
 *    while content loads, giving the page structural stability so
 *    the layout doesn't jump when data arrives.
 *
 * WHY TWO DIFFERENT PATTERNS?
 *   - Full-page spinner: best for initial page loads or large route
 *     transitions where the entire page is blank.
 *   - Skeleton/pulse: best for incremental loading within an already-
 *     rendered page (e.g., a grid of cards where some load before others).
 *     It reduces Cumulative Layout Shift (CLS) — a Core Web Vital.
 *
 * TAILWIND ANIMATION CLASSES
 *   - `animate-spin`  — rotates 360° continuously (1s linear infinite).
 *   - `animate-pulse` — fades opacity 1 → 0.5 → 1 (2s ease infinite).
 *   Both are defined in Tailwind's default config; no custom CSS needed.
 *
 * SERVER vs CLIENT
 *   These components are pure presentational markup with no state or
 *   event handlers — they are Server Components. Next.js also allows
 *   you to create a special `loading.tsx` file in any route segment,
 *   which Next.js will automatically show while the segment's data
 *   is streaming. This component can be used in that file:
 *     // app/countries/loading.tsx
 *     export { default } from '@/components/ui/Loading'
 * ============================================================
 */

// ─── Full-page loading spinner ────────────────────────────────────────────────

/**
 * Full-page centred loading indicator.
 * Place this in loading.tsx or wherever a blocking spinner is needed.
 *
 * @example
 * // app/dashboard/loading.tsx
 * export { default } from '@/components/ui/Loading'
 */
export default function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
      role="status"
      aria-label="Loading content"
    >
      {/* Cricket ball spinning animation.
          `animate-spin` applies: transform rotate 0→360deg, 1s linear infinite.
          The `will-change-transform` hint helps the browser use the GPU compositor. */}
      <div
        className="text-5xl animate-spin"
        style={{ animationDuration: '1.2s' }}
        aria-hidden="true"
      >
        🏏
      </div>

      {/* Visible text — also the accessible label for the spinner region */}
      <p className="text-emerald-400 text-sm font-medium animate-pulse">
        Loading…
      </p>
    </div>
  )
}

// ─── Skeleton card placeholder ────────────────────────────────────────────────

/**
 * A skeleton "ghost" card that pulses while real content loads.
 * Mimics the rough shape of CountryCard / LeagueCard.
 *
 * USAGE — render an array of these while data is fetching:
 * @example
 * {isLoading
 *   ? Array.from({ length: 6 }).map((_, i) => <LoadingCard key={i} />)
 *   : cards.map(c => <CountryCard key={c.id} country={c} />)
 * }
 */
export function LoadingCard() {
  return (
    // `animate-pulse` applies: opacity 1 → 0.5 → 1, 2s ease infinite
    <div
      className="bg-emerald-950 border border-emerald-800 rounded-xl p-5 animate-pulse"
      aria-hidden="true"       // Screen readers should ignore skeleton placeholders
    >
      {/* Header row: fake flag circle + fake title block */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-emerald-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-emerald-800 rounded-full w-3/4" />
          <div className="h-3 bg-emerald-900 rounded-full w-1/4" />
        </div>
      </div>

      {/* Fake stat rows */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-3 bg-emerald-800 rounded-full w-1/4" />
          <div className="h-3 bg-emerald-800 rounded-full w-1/3" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 bg-emerald-800 rounded-full w-1/4" />
          <div className="h-3 bg-emerald-800 rounded-full w-2/5" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 bg-emerald-800 rounded-full w-1/4" />
          <div className="h-3 bg-emerald-800 rounded-full w-1/3" />
        </div>
      </div>

      {/* Fake footer row */}
      <div className="mt-4 pt-3 border-t border-emerald-800/40">
        <div className="h-3 bg-emerald-900 rounded-full w-1/5" />
      </div>
    </div>
  )
}

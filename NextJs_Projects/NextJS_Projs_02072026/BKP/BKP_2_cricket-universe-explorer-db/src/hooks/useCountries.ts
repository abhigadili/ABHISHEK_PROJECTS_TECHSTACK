'use client'

/**
 * ============================================================
 * useCountries — custom hook for fetching the countries list
 * ============================================================
 *
 * WHEN TO WRITE A CUSTOM HOOK
 * ────────────────────────────
 * A custom hook is the right abstraction when:
 *   1. The same combination of useState + useEffect (or other
 *      hooks) appears in more than one component.
 *   2. The logic is complex enough that inlining it would make
 *      the component hard to read.
 *   3. You want to unit-test the data-fetching logic in isolation
 *      from the rendering logic.
 *
 * Custom hooks are just functions whose name starts with "use"
 * — they can call any React hook internally.  The "use" prefix
 * tells React (and linters) to enforce the Rules of Hooks.
 *
 * REACT 18 CONCURRENT FEATURES & DATA FETCHING
 * ──────────────────────────────────────────────
 * React 18 introduced concurrent rendering — React can pause,
 * interrupt, and restart rendering work.  This affects hooks:
 *
 * • useEffect still runs after the browser paints, making it
 *   safe for side-effects that don't need to block rendering.
 *
 * • React 19 (used in this project) adds the `use()` hook which
 *   can suspend on a Promise directly inside render — but for
 *   simple client-side fetch patterns, useEffect is still clear
 *   and predictable.
 *
 * • In Next.js App Router, prefer fetching on the SERVER in
 *   Server Components (await fetch in the component body).
 *   This hook is useful when you need CLIENT-SIDE refetching,
 *   e.g., after a mutation, or when the data depends on
 *   client-only state like auth tokens in memory.
 *
 * ABORT CONTROLLER — WHY IT MATTERS
 * ────────────────────────────────────
 * Without an AbortController, if the component unmounts before
 * the fetch resolves (e.g., fast navigation away), the callback
 * still runs and calls setState on an unmounted component.
 * In React 18 Strict Mode, effects run twice in development —
 * making this bug more visible.  The cleanup function returned
 * from useEffect aborts the in-flight request and prevents the
 * stale update.
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react'
import type { Country } from '@/types'

// ─────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────

interface UseCountriesResult {
  /** The fetched country list, empty array while loading */
  countries: Country[]
  /** True while the first (or a manual refetch) request is in-flight */
  loading: boolean
  /** Error message string, or null when there is no error */
  error: string | null
  /**
   * Call this to manually re-trigger the fetch.
   * Useful after a mutation (e.g., user adds a custom country)
   * or when implementing a "retry" button on error.
   */
  refetch: () => void
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * useCountries — fetches GET /api/countries on mount and returns
 * reactive loading/error/data state.
 *
 * Usage:
 *   const { countries, loading, error, refetch } = useCountries()
 */
export function useCountries(): UseCountriesResult {
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * `fetchTrigger` is a counter that we increment to re-run the
   * effect.  This is a common pattern for "refetchable" effects:
   * the effect depends on the counter, so incrementing it causes
   * React to re-run the effect.
   *
   * Alternative: you could also move the fetch logic into a
   * useCallback and call it directly, but the counter approach
   * keeps the AbortController cleanup inside useEffect naturally.
   */
  const [fetchTrigger, setFetchTrigger] = useState<number>(0)

  const refetch = useCallback(() => {
    setFetchTrigger((n) => n + 1)
  }, [])

  useEffect(() => {
    /**
     * AbortController lets us cancel the fetch when the component
     * unmounts or when `refetch` is called before the previous
     * request finishes (race condition prevention).
     */
    const controller = new AbortController()

    async function fetchCountries() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/countries', {
          signal: controller.signal,
        })

        if (!response.ok) {
          // HTTP error (4xx / 5xx) — not caught by the catch block
          throw new Error(
            `Failed to fetch countries: ${response.status} ${response.statusText}`,
          )
        }

        const json: { data: Country[]; success: boolean; message?: string } =
          await response.json()

        if (!json.success) {
          throw new Error(json.message ?? 'Unknown API error')
        }

        setCountries(json.data)
      } catch (err: unknown) {
        /**
         * Ignore AbortError — it's not a real error, just the
         * cleanup cancelling the request on unmount.
         */
        if (err instanceof DOMException && err.name === 'AbortError') return

        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchCountries()

    /**
     * Cleanup function — React calls this before re-running the
     * effect (when fetchTrigger changes) and when the component
     * unmounts.  Aborting here prevents stale state updates.
     */
    return () => {
      controller.abort()
    }
  }, [fetchTrigger]) // re-runs when fetchTrigger increments (refetch)

  return { countries, loading, error, refetch }
}

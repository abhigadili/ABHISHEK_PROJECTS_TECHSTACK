/**
 * ============================================================
 * useDebounce — delay propagating a rapidly-changing value
 * ============================================================
 *
 * WHY DEBOUNCE?
 * ──────────────
 * Some user inputs fire dozens of events per second — search
 * boxes, resize handlers, scroll events.  Acting on every event
 * would:
 *   • Hammer an API with hundreds of unnecessary requests
 *   • Cause expensive re-renders on every keystroke
 *   • Degrade the user experience with flickering results
 *
 * Debouncing solves this by waiting until the value has been
 * STABLE for `delay` milliseconds before propagating it.
 * The timer resets on every new value, so only the final value
 * after the user stops typing is forwarded.
 *
 * TYPICAL DELAY VALUES
 * ─────────────────────
 *   • 150–300 ms — search boxes (feels instant, avoids excess calls)
 *   • 500 ms     — auto-save (generous margin to avoid mid-word saves)
 *   • 16–32 ms   — animation frames (almost never debounced; use rAF)
 *
 * CLOSURE IN useEffect
 * ─────────────────────
 * Inside useEffect, the callback function forms a CLOSURE over
 * `value` and `delay`.  A closure is a function that "remembers"
 * the variables from its surrounding scope even after the outer
 * function has returned.
 *
 * Each render creates a new effect with a fresh closure over
 * the current `value` and `delay`.  The dependency array
 * [value, delay] tells React to create a new effect (and cancel
 * the previous one) whenever either changes.
 *
 * This is why the cleanup function (return () => clearTimeout)
 * cancels the timer from the PREVIOUS render's effect — the one
 * with the old `value`.  Only the latest timer fires.
 *
 * GENERIC HOOKS
 * ──────────────
 * The type parameter <T> makes this hook work with any value
 * type: string, number, object, array, etc.
 *
 *   const debouncedQuery  = useDebounce<string>(query, 300)
 *   const debouncedFilter = useDebounce<FilterOptions>(filter, 200)
 *
 * TypeScript infers T from the `value` argument in most cases,
 * so the explicit <T> is optional in practice:
 *   const debounced = useDebounce(query, 300)  // T inferred as string
 *
 * Interview tip: Generic hooks are the functional equivalent of
 * generic utility functions.  They provide type safety without
 * forcing consumers into a specific type.
 * ============================================================
 */

import { useState, useEffect } from 'react'

/**
 * useDebounce — returns a debounced copy of `value` that only
 * updates after `delay` milliseconds of no new values.
 *
 * @param value - The reactive value to debounce (e.g., a search query)
 * @param delay - Milliseconds to wait after the last change before
 *                propagating the new value
 * @returns     The debounced value (same type as `value`)
 *
 * Usage:
 *   const [query, setQuery] = useState('')
 *   const debouncedQuery = useDebounce(query, 300)
 *
 *   // Only fires when the user stops typing for 300 ms:
 *   useEffect(() => {
 *     if (debouncedQuery) fetchResults(debouncedQuery)
 *   }, [debouncedQuery])
 */
export function useDebounce<T>(value: T, delay: number): T {
  /**
   * `debouncedValue` starts as the current `value`.
   * It will only update after `delay` ms of stability.
   */
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    /**
     * Schedule an update after `delay` ms.
     *
     * setTimeout returns a numeric ID (NodeJS.Timeout in Node,
     * number in browsers).  We store it to cancel it in cleanup.
     *
     * CLOSURE: the arrow function passed to setTimeout closes
     * over `value` from this render.  If the component re-renders
     * before the timer fires, the cleanup cancels this timer
     * and a NEW effect starts with the new `value`.
     */
    const timerId = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    /**
     * Cleanup — React calls this:
     *   1. Before running the effect again (when value or delay changes)
     *   2. When the component unmounts
     *
     * Clearing the timeout prevents the stale value from being
     * set after the timer from a previous render fires.
     */
    return () => {
      clearTimeout(timerId)
    }
  }, [value, delay])
  // ↑ Re-run the effect whenever value or delay changes.
  // A new render = new timer, old timer is cancelled in cleanup.

  return debouncedValue
}

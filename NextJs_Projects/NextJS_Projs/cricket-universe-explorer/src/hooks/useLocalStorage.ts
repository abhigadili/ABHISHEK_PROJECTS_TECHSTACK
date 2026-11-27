/**
 * ============================================================
 * useLocalStorage — generic hook for synced localStorage state
 * ============================================================
 *
 * SSR HYDRATION ISSUES — WHY THE `typeof window` CHECK MATTERS
 * ──────────────────────────────────────────────────────────────
 * Next.js renders components TWICE:
 *   1. SERVER: renders HTML for fast first paint + SEO.
 *              `window`, `localStorage`, `document` are UNDEFINED.
 *   2. CLIENT: React "hydrates" the server HTML by attaching
 *              event listeners and running hooks.
 *
 * If you call `localStorage.getItem()` during the server render,
 * Node.js throws `ReferenceError: localStorage is not defined`
 * and the build fails (or the page crashes at runtime).
 *
 * The fix:
 *   • Check `typeof window !== 'undefined'` before accessing
 *     any browser API.
 *   • Use `useState` lazy initialiser (a function argument) so
 *     the localStorage read only happens client-side, on mount.
 *
 * HYDRATION MISMATCH WARNING
 * ───────────────────────────
 * If the server renders a component with the `initialValue`
 * (e.g., `theme: 'dark'`) but the client reads `'light'` from
 * localStorage, React prints a hydration mismatch warning and
 * the client re-renders with the stored value.
 *
 * For most use cases (theme, preferences) this single extra
 * render is acceptable.  If you need zero flicker, use a CSS
 * variable injected by a blocking <script> tag in _document.
 *
 * GENERIC TYPE PARAMETER
 * ───────────────────────
 * <T> makes this hook work with any serialisable value:
 *   useLocalStorage<string>('name', '')
 *   useLocalStorage<number>('count', 0)
 *   useLocalStorage<string[]>('tags', [])
 *   useLocalStorage<UserPrefs>('prefs', defaultPrefs)
 *
 * Values are stored as JSON strings (JSON.stringify / JSON.parse),
 * so T must be JSON-serialisable.  Functions, Sets, and Maps
 * will not round-trip correctly through JSON.
 *
 * Interview tip: Generic hooks give you the type-safety of a
 * specialised hook with the reusability of a generic one.
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * useLocalStorage — synchronise a React state value with
 * a localStorage key.
 *
 * @param key          - The localStorage key to read/write
 * @param initialValue - Fallback value when no stored value exists
 * @returns            A [value, setValue] tuple, just like useState
 *
 * Usage:
 *   const [theme, setTheme] = useLocalStorage<string>('theme', 'dark')
 *   const [tags, setTags]   = useLocalStorage<string[]>('tags', [])
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  /**
   * Lazy initialiser — the function is called only ONCE on mount.
   * This is where we safely read localStorage because lazy
   * initialisers run client-side only (they run during the first
   * render after hydration, not during SSR).
   *
   * We wrap in try/catch because:
   *   • localStorage can be disabled by the browser (privacy mode)
   *   • The stored value might be malformed JSON
   *   • Quota exceeded errors can occur on write (handled in setValue)
   */
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Guard: localStorage doesn't exist on the server
    if (typeof window === 'undefined') return initialValue

    try {
      const item = window.localStorage.getItem(key)
      // Parse stored JSON or return the initial value if nothing stored
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch {
      // Malformed JSON or security error — fall back to initialValue
      return initialValue
    }
  })

  /**
   * setValue — updates both React state and localStorage atomically.
   *
   * useCallback ensures this function reference is stable, which
   * matters if consumers pass it as a prop or dependency.
   *
   * We read the CURRENT state via a functional updater when `value`
   * is a function (mirrors the React setState overload where you can
   * pass a callback that receives the previous value).
   */
  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(value))
        }
      } catch (error) {
        /**
         * Common failures:
         *   • QuotaExceededError — localStorage is full
         *   • SecurityError — third-party iframe with cookies blocked
         *
         * We log in development so developers know about the problem,
         * but don't throw — the component still works with in-memory state.
         */
        if (process.env.NODE_ENV === 'development') {
          console.warn(`useLocalStorage: failed to write key "${key}"`, error)
        }
      }
    },
    [key],
  )

  /**
   * Cross-tab synchronisation — listen for storage events fired
   * when OTHER tabs write to the same key.
   *
   * The 'storage' event is NOT fired in the tab that made the
   * change — only in other tabs.  This keeps all tabs in sync.
   *
   * Interview tip: This is an example of a browser API that only
   * works client-side, which is why we guard with typeof window.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== key) return
      if (event.newValue === null) {
        // Key was deleted in another tab — reset to initialValue
        setStoredValue(initialValue)
        return
      }
      try {
        setStoredValue(JSON.parse(event.newValue) as T)
      } catch {
        // Ignore malformed values from other tabs
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, initialValue])

  return [storedValue, setValue]
}

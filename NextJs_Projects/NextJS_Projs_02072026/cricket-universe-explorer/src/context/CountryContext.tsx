'use client'

/**
 * ============================================================
 * CountryContext — selected country global state
 * ============================================================
 *
 * WHEN IS CONTEXT THE RIGHT CHOICE?
 * ───────────────────────────────────
 * Context shines for low-frequency, "ambient" state — values
 * that change rarely but need to be read by many components at
 * different depths of the tree.
 *
 * `selectedCountry` is a perfect fit:
 *   • It changes only when the user explicitly clicks a country
 *     (infrequent writes)
 *   • Many components may display the selected country name or
 *     flag in a header/sidebar (wide reads)
 *   • There is no complex update logic — just a setter function
 *
 * COMPARE WITH A HIGH-FREQUENCY COUNTER-EXAMPLE
 * ───────────────────────────────────────────────
 * If you stored "hovered country ID" (changes on every mouseover)
 * in Context, every consumer would re-render on every mouse
 * movement — a performance disaster.  For that pattern, use
 * local useState in the component that owns the hover, or a
 * Zustand store with a selector so only the relevant component
 * subscribes.
 *
 * WHY NOT ZUSTAND FOR THIS?
 * ──────────────────────────
 * You could use Zustand here, but Context is simpler when:
 *   • No persistence is needed (we don't save selected country
 *     across page refreshes — it resets on navigation)
 *   • No complex derived state or middleware is needed
 *   • The state is scoped to a subtree (e.g., a page that shows
 *     country details) rather than truly app-global
 *
 * Rule of thumb: "Will this break if the user refreshes?"
 *   → No?  Context is fine.
 *   → Yes? Use Zustand + persist middleware.
 * ============================================================
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { Country } from '@/types'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CountryContextValue {
  /** The currently selected Country object, or null if none. */
  selectedCountry: Country | null
  /**
   * Update the selected country.  Pass null to deselect.
   *
   * @param country - A Country object from the countries data
   *                  source, or null to clear the selection.
   */
  setSelectedCountry: (country: Country | null) => void
}

// ─────────────────────────────────────────────
// Context creation
// ─────────────────────────────────────────────

/**
 * Initialised as `undefined` so the custom hook can detect and
 * report misuse (consumer rendered outside a Provider).
 */
const CountryContext = createContext<CountryContextValue | undefined>(undefined)

// ─────────────────────────────────────────────
// CountryProvider
// ─────────────────────────────────────────────

interface CountryProviderProps {
  children: ReactNode
}

/**
 * Provides `selectedCountry` and `setSelectedCountry` to the
 * entire subtree it wraps.
 *
 * Placement advice:
 *   • If selection should persist across routes: place in
 *     app/providers.tsx (root level).
 *   • If selection is scoped to the countries section: place in
 *     the countries layout or page component.
 */
export function CountryProvider({ children }: CountryProviderProps) {
  const [selectedCountry, setSelectedCountryState] = useState<Country | null>(
    null,
  )

  /**
   * Stable callback reference via useCallback.
   * Empty dependency array: this function never needs to be
   * recreated because it only calls the state setter, which is
   * already stable (React guarantees setState stability).
   */
  const setSelectedCountry = useCallback((country: Country | null) => {
    setSelectedCountryState(country)
  }, [])

  /**
   * Memoised context value — prevents unnecessary re-renders in
   * consumers when the CountryProvider itself re-renders for
   * unrelated reasons (e.g., a parent re-render).
   */
  const value = useMemo<CountryContextValue>(
    () => ({ selectedCountry, setSelectedCountry }),
    [selectedCountry, setSelectedCountry],
  )

  return (
    <CountryContext.Provider value={value}>{children}</CountryContext.Provider>
  )
}

// ─────────────────────────────────────────────
// Custom hook
// ─────────────────────────────────────────────

/**
 * useCountry — clean API for consuming CountryContext.
 *
 * Usage:
 *   const { selectedCountry, setSelectedCountry } = useCountry()
 *
 * If called outside a <CountryProvider>, this hook throws a
 * descriptive error to make debugging straightforward.
 */
export function useCountry(): CountryContextValue {
  const ctx = useContext(CountryContext)
  if (ctx === undefined) {
    throw new Error(
      '`useCountry` must be called inside a <CountryProvider>.\n' +
        'Ensure <CountryProvider> wraps this component in the tree.',
    )
  }
  return ctx
}

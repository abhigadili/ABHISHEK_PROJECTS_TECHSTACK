/**
 * ============================================================
 * searchStore — Zustand store for search query and results
 * ============================================================
 *
 * ZUSTAND WITH TYPESCRIPT — KEY PATTERNS
 * ────────────────────────────────────────
 *
 * 1. Generic type parameter on `create`
 *    Pass the store type explicitly: `create<SearchStore>()(...)`.
 *    The double-call `create<T>()( ... )` is required because
 *    TypeScript cannot infer the generic from a curried function
 *    that returns another function — the extra `()` is the "type
 *    parameter workaround" documented in Zustand's TypeScript guide.
 *
 * 2. Separate State and Actions interfaces
 *    Keeps the shape self-documenting and makes it easy to write
 *    tests that construct just the state without the actions.
 *
 * 3. Selectors for performance
 *    A component that only shows the `searchQuery` input value
 *    should select only that slice:
 *      const query = useSearchStore(s => s.searchQuery)
 *    It will NOT re-render when `searchResults` or `isSearching`
 *    changes — only when `searchQuery` itself changes.
 *
 * 4. No persist here — intentional
 *    Search state is ephemeral: if the user refreshes the page,
 *    they'd expect a blank search box, not their last query.
 *    Contrast this with the favorites store where persistence
 *    is the whole point.
 *
 * WHY ZUSTAND FOR SEARCH INSTEAD OF LOCAL useState?
 * ──────────────────────────────────────────────────
 * The search bar might live in a Header component, but the
 * results panel might be in a completely separate part of the
 * tree.  Lifting state up to a common ancestor would require
 * threading props through many layers.
 *
 * With Zustand, any component can read or update search state
 * without being directly connected in the component tree —
 * exactly like a lightweight Redux, but without the boilerplate.
 * ============================================================
 */

import { create } from 'zustand'
import type { Country, Team, Cricketer } from '@/types'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * The shape of the search results object.
 *
 * Interview tip: Grouping results by entity type (not a flat
 * array of mixed items) makes it easy to render typed sections
 * in the UI ("Countries (3)", "Teams (7)", …) without needing
 * a `type` discriminant on each result.
 */
interface SearchResults {
  countries: Country[]
  teams: Team[]
  cricketers: Cricketer[]
}

/** Empty results sentinel — used as the initial value */
const EMPTY_RESULTS: SearchResults = {
  countries: [],
  teams: [],
  cricketers: [],
}

interface SearchState {
  /** The raw string the user typed into the search input */
  searchQuery: string
  /** Grouped results populated after a successful search */
  searchResults: SearchResults
  /**
   * True while an async search request is in-flight.
   * Components use this to show a spinner or skeleton UI.
   */
  isSearching: boolean
}

interface SearchActions {
  /**
   * Update the search query string.
   * Typically called from a debounced onChange handler so we
   * don't fire a request on every keystroke (see useDebounce).
   */
  setSearchQuery: (query: string) => void
  /**
   * Populate search results after a successful fetch.
   * Also sets isSearching to false.
   */
  setSearchResults: (results: SearchResults) => void
  /**
   * Reset the store to its initial blank state.
   * Call this when the user dismisses the search UI or
   * navigates away.
   */
  clearSearch: () => void
  /**
   * Mark an in-flight search as started/finished.
   * Useful when you want to show a loading indicator before
   * results arrive.
   */
  setIsSearching: (value: boolean) => void
}

/** Combined type for `create<SearchStore>()` */
type SearchStore = SearchState & SearchActions

// ─────────────────────────────────────────────
// Store definition
// ─────────────────────────────────────────────

export const useSearchStore = create<SearchStore>()((set) => ({
  // ── Initial state ───────────────────────────────────────────
  searchQuery: '',
  searchResults: EMPTY_RESULTS,
  isSearching: false,

  // ── Actions ─────────────────────────────────────────────────

  /**
   * setSearchQuery — store the debounced query string.
   *
   * Tip: Don't call setIsSearching(true) here; that should happen
   * in the component/hook that initiates the fetch, giving you
   * fine-grained control over the loading state.
   */
  setSearchQuery: (query: string) =>
    set({ searchQuery: query }),

  /**
   * setSearchResults — called when the fetch resolves.
   * We atomically update both results and isSearching so there's
   * no render cycle where results are populated but the spinner
   * is still showing.
   */
  setSearchResults: (results: SearchResults) =>
    set({ searchResults: results, isSearching: false }),

  /**
   * clearSearch — reset everything to blank state.
   *
   * Interview tip: Resetting to a known constant (EMPTY_RESULTS)
   * is safer than spreading partial state — it prevents stale
   * properties from leaking if the shape changes.
   */
  clearSearch: () =>
    set({
      searchQuery: '',
      searchResults: EMPTY_RESULTS,
      isSearching: false,
    }),

  setIsSearching: (value: boolean) =>
    set({ isSearching: value }),
}))

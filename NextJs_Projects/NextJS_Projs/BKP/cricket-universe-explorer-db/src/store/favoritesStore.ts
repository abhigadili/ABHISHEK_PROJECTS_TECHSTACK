/**
 * ============================================================
 * favoritesStore — Zustand store with localStorage persistence
 * ============================================================
 *
 * WHY ZUSTAND OVER REDUX?
 * ────────────────────────
 * Redux is powerful, but it comes with significant ceremony:
 *   • Reducers, action creators, action type constants
 *   • combineReducers, configureStore, Provider wrapper
 *   • Middleware setup (redux-thunk / redux-saga for async)
 *   • connect() or useSelector/useDispatch boilerplate
 *
 * Zustand achieves the same result with a fraction of the code:
 *   • One `create()` call defines state AND actions together
 *   • No Provider wrapper needed — state lives outside React
 *   • Built-in TypeScript inference — no extra type declarations
 *   • Middleware (persist, devtools, immer) is opt-in per store
 *   • Tree-shakeable — you only bundle what you import
 *
 * WHEN TO USE ZUSTAND VS CONTEXT
 * ────────────────────────────────
 * Use Zustand when:
 *   ✓ State updates are frequent (search, filters, scroll pos)
 *   ✓ You need persistence (localStorage, sessionStorage)
 *   ✓ You need devtools integration for debugging
 *   ✓ Multiple unrelated components subscribe to different slices
 *   ✓ You need to access/update state outside React components
 *     (e.g., inside a fetch utility or an event listener)
 *   ✓ State is truly global (survives route changes)
 *
 * Use Context when:
 *   ✓ State changes rarely (theme, auth, i18n)
 *   ✓ You want zero extra dependencies
 *   ✓ State is scoped to a subtree (not the whole app)
 *
 * INTERVIEW TIP: ZUSTAND vs CONTEXT vs REDUX vs JOTAI
 * ─────────────────────────────────────────────────────
 *
 *  Library    | Bundle  | Re-render control | Boilerplate | Persist
 *  ────────────|─────────|───────────────────|─────────────|────────
 *  Context    | 0 KB    | Whole tree         | Low         | Manual
 *  Zustand    | ~1 KB   | Per-selector       | Low         | Built-in
 *  Redux TK   | ~15 KB  | Per-selector       | Medium      | Plugin
 *  Jotai      | ~3 KB   | Per-atom           | Very low    | Built-in
 *  Recoil     | ~20 KB  | Per-atom           | Low         | Plugin
 *
 *  • Context  — zero-dep, great for theme/auth, bad for high-frequency
 *  • Zustand  — lightweight, fine-grained, best default for most apps
 *  • Redux TK — enterprise standard, time-travel debugging, large teams
 *  • Jotai    — atomic (bottom-up) model, great for derived state
 *
 * PERSIST MIDDLEWARE
 * ───────────────────
 * `persist` wraps your store creator and automatically:
 *   1. Reads the stored JSON from localStorage on first mount
 *      (hydration) and merges it into the initial state.
 *   2. Subscribes to state changes and writes them back to
 *      localStorage on every update (dehydration).
 *
 * The `name` option is the localStorage key.
 * The `partialize` option lets you persist only specific slices
 * (e.g., skip ephemeral UI state like `isLoading`).
 *
 * ZUSTAND SELECTORS FOR PERFORMANCE
 * ────────────────────────────────────
 * Without selectors, every state change re-renders ALL consumers:
 *   const store = useFavoritesStore()   // ← re-renders on ANY change
 *
 * With selectors, a component only re-renders when its slice changes:
 *   const favCountries = useFavoritesStore(s => s.favoriteCountries)
 *   const toggle       = useFavoritesStore(s => s.toggleFavoriteCountry)
 *
 * For multiple slices, use the `useShallow` helper from 'zustand/react/shallow'
 * to do a shallow-equality check and avoid spurious re-renders:
 *   import { useShallow } from 'zustand/react/shallow'
 *   const { favoriteCountries, toggleFavoriteCountry } = useFavoritesStore(
 *     useShallow(s => ({
 *       favoriteCountries: s.favoriteCountries,
 *       toggleFavoriteCountry: s.toggleFavoriteCountry,
 *     }))
 *   )
 * ============================================================
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─────────────────────────────────────────────
// State & Actions types
// ─────────────────────────────────────────────

/**
 * Separating State and Actions into two interfaces is a Zustand
 * best practice — it makes the shape self-documenting and
 * allows you to use `FavoritesState` in tests without the actions.
 */
interface FavoritesState {
  /** Array of favorited Country ids */
  favoriteCountries: string[]
  /** Array of favorited Team ids */
  favoriteTeams: string[]
  /** Array of favorited Cricketer ids */
  favoriteCricketers: string[]
}

interface FavoritesActions {
  /**
   * Add `id` to favoriteCountries if absent; remove it if present.
   * The toggle pattern avoids separate add/remove actions and
   * keeps the API surface small.
   */
  toggleFavoriteCountry: (id: string) => void
  /** Same toggle logic for teams */
  toggleFavoriteTeam: (id: string) => void
  /** Same toggle logic for cricketers */
  toggleFavoriteCricketer: (id: string) => void

  /** Read-only selector: true when `id` is in favoriteCountries */
  isFavoriteCountry: (id: string) => boolean
  /** Read-only selector: true when `id` is in favoriteTeams */
  isFavoriteTeam: (id: string) => boolean
  /** Read-only selector: true when `id` is in favoriteCricketers */
  isFavoriteCricketer: (id: string) => boolean

  /** Remove every favorited id across all three categories */
  clearAllFavorites: () => void
}

/** Full store type — state + actions combined */
type FavoritesStore = FavoritesState & FavoritesActions

// ─────────────────────────────────────────────
// Helper — generic toggle for an id array
// ─────────────────────────────────────────────

/**
 * Returns a new array with `id` added if it wasn't present,
 * or removed if it was.  Using filter+spread keeps the arrays
 * immutable — Zustand (like React) requires immutable updates.
 */
function toggleId(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
}

// ─────────────────────────────────────────────
// Store definition
// ─────────────────────────────────────────────

/**
 * useFavoritesStore — the Zustand hook consumers call.
 *
 * The outer `persist(...)` wraps our state creator so Zustand
 * automatically syncs state ↔ localStorage under the key
 * 'cricket-universe-favorites'.
 *
 * Usage (selector pattern for performance):
 *   const isFav = useFavoritesStore(s => s.isFavoriteCountry)
 *   const toggle = useFavoritesStore(s => s.toggleFavoriteCountry)
 */
export const useFavoritesStore = create<FavoritesStore>()(
  /**
   * persist middleware — first arg is the state creator, second
   * arg is PersistOptions.
   *
   * `partialize` is used to persist only the three id arrays.
   * If we ever add ephemeral UI state (e.g., `isPanelOpen`) to
   * this store, it won't be incorrectly saved to localStorage.
   */
  persist(
    (set, get) => ({
      // ── Initial state ─────────────────────────────────────
      favoriteCountries: [],
      favoriteTeams: [],
      favoriteCricketers: [],

      // ── Toggle actions ────────────────────────────────────

      toggleFavoriteCountry: (id: string) =>
        set((state) => ({
          favoriteCountries: toggleId(state.favoriteCountries, id),
        })),

      toggleFavoriteTeam: (id: string) =>
        set((state) => ({
          favoriteTeams: toggleId(state.favoriteTeams, id),
        })),

      toggleFavoriteCricketer: (id: string) =>
        set((state) => ({
          favoriteCricketers: toggleId(state.favoriteCricketers, id),
        })),

      // ── Selector actions ──────────────────────────────────
      //
      // Storing selectors as actions is a Zustand pattern that
      // keeps related logic inside the store.  The component
      // can call `isFavoriteCountry(id)` without having to
      // import the whole array and do `.includes()` itself.
      //
      // Interview tip: `get()` provides synchronous access to
      // the current state inside an action — useful when you
      // need to read state without triggering a re-render.

      isFavoriteCountry: (id: string) =>
        get().favoriteCountries.includes(id),

      isFavoriteTeam: (id: string) =>
        get().favoriteTeams.includes(id),

      isFavoriteCricketer: (id: string) =>
        get().favoriteCricketers.includes(id),

      // ── Clear action ──────────────────────────────────────

      clearAllFavorites: () =>
        set({
          favoriteCountries: [],
          favoriteTeams: [],
          favoriteCricketers: [],
        }),
    }),

    // ── persist options ──────────────────────────────────────
    {
      /**
       * Unique localStorage key for this store.
       * Tip: namespace keys (e.g., 'app-name:store-name') to
       * avoid collisions when multiple apps run on the same origin.
       */
      name: 'cricket-universe-favorites',

      /**
       * Only persist the three id arrays — not the action functions.
       * `partialize` receives the full state and returns the subset
       * to serialise.  Functions are not JSON-serialisable anyway,
       * so always exclude them here.
       */
      partialize: (state) => ({
        favoriteCountries: state.favoriteCountries,
        favoriteTeams: state.favoriteTeams,
        favoriteCricketers: state.favoriteCricketers,
      }),
    },
  ),
)

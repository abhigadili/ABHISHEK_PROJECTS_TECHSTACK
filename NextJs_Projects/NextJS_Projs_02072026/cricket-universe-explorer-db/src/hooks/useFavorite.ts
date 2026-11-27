'use client'

/**
 * ============================================================
 * useFavorite — thin adapter hook over the Zustand favorites store
 * ============================================================
 *
 * COMPOSING HOOKS — THE DRY PRINCIPLE
 * ─────────────────────────────────────
 * Without this hook, every component that renders a "favorite"
 * button would have to:
 *   1. Import useFavoritesStore
 *   2. Know which selector to call (isFavoriteCountry vs isFavoriteTeam)
 *   3. Know which action to call (toggleFavoriteCountry vs toggleFavoriteTeam)
 *   4. Construct the same conditional logic three times
 *
 * By composing the store access into one parameterised hook we:
 *   • Keep each component's code to two lines
 *   • Centralise the type → action mapping in one place
 *   • Make it trivial to add a new entity type (e.g., 'league')
 *     by editing this one file
 *
 * This is the DRY (Don't Repeat Yourself) principle applied to
 * hook composition — the same way a utility function removes
 * repeated logic from regular code.
 *
 * HOOK COMPOSITION PATTERN
 * ─────────────────────────
 * A hook that calls another hook is the React equivalent of a
 * function that calls another function — it's a building block.
 *
 *   useFavorite (this file)        ← high-level, component-facing
 *     └─ useFavoritesStore         ← low-level, Zustand store hook
 *
 * This layering keeps each layer focused on one concern:
 *   • useFavoritesStore: manages the data structure
 *   • useFavorite: provides the right slice for a specific entity
 *
 * Interview tip: Hook composition is how you achieve separation
 * of concerns in functional React components — the same way
 * class hierarchies did it in OOP (but simpler and more flexible).
 * ============================================================
 */

import { useFavoritesStore } from '@/store/favoritesStore'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * The three entity types this hook supports.
 * Extend this union when new favoritable entities are added
 * to the application.
 */
type FavoriteType = 'country' | 'team' | 'cricketer'

interface UseFavoriteResult {
  /** True when the given id is in the favorites list */
  isFavorite: boolean
  /**
   * Toggles the favorite status of the given id.
   * Calling it on a non-favorite adds it; on a favorite removes it.
   */
  toggleFavorite: () => void
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * useFavorite — generic hook for any favoritable entity.
 *
 * @param type - Entity category: 'country' | 'team' | 'cricketer'
 * @param id   - The entity's unique identifier string
 *
 * Usage:
 *   const { isFavorite, toggleFavorite } = useFavorite('country', 'ind')
 *
 *   return (
 *     <button onClick={toggleFavorite}>
 *       {isFavorite ? '★ Saved' : '☆ Save'}
 *     </button>
 *   )
 */
export function useFavorite(type: FavoriteType, id: string): UseFavoriteResult {
  /**
   * We select all three is* functions at once so we can
   * call the right one based on `type`.
   *
   * Performance note: selecting multiple values together avoids
   * calling useFavoritesStore three times (each call registers
   * a separate subscription).  With `useShallow` from Zustand we
   * could make this even more efficient for larger objects, but
   * for three booleans the overhead is negligible.
   */
  const isFavoriteCountry = useFavoritesStore((s) => s.isFavoriteCountry)
  const isFavoriteTeam = useFavoritesStore((s) => s.isFavoriteTeam)
  const isFavoriteCricketer = useFavoritesStore((s) => s.isFavoriteCricketer)

  const toggleFavoriteCountry = useFavoritesStore(
    (s) => s.toggleFavoriteCountry,
  )
  const toggleFavoriteTeam = useFavoritesStore((s) => s.toggleFavoriteTeam)
  const toggleFavoriteCricketer = useFavoritesStore(
    (s) => s.toggleFavoriteCricketer,
  )

  /**
   * Map the `type` parameter to the correct store functions.
   *
   * Using a lookup object (record) is cleaner than a switch/else-if
   * chain and makes it trivial to add new entity types.
   */
  const checkers: Record<FavoriteType, (id: string) => boolean> = {
    country: isFavoriteCountry,
    team: isFavoriteTeam,
    cricketer: isFavoriteCricketer,
  }

  const togglers: Record<FavoriteType, (id: string) => void> = {
    country: toggleFavoriteCountry,
    team: toggleFavoriteTeam,
    cricketer: toggleFavoriteCricketer,
  }

  return {
    isFavorite: checkers[type](id),
    toggleFavorite: () => togglers[type](id),
  }
}

/**
 * ============================================================
 * app/countries/@modal/default.tsx — Default Slot (No Modal)
 * ============================================================
 *
 * WHY DEFAULT.TSX IS REQUIRED:
 *   When using parallel routes, Next.js renders all slot pages for
 *   the current URL. When the user is on /countries (the list page),
 *   there is no @modal/page.tsx at that URL level.
 *
 *   Without default.tsx, Next.js cannot render the `modal` slot and
 *   will show a 404 error. The default.tsx acts as a "fallback" —
 *   it renders when no slot-specific page matches the current URL.
 *
 * WHAT DOES IT RETURN?
 *   null — meaning the modal slot renders nothing when no modal
 *   should be open. This is the initial/default state of the layout.
 *
 * WHEN IS DEFAULT.TSX USED?
 *   - /countries:
 *     URL has no [countryId] segment → no intercepting route matches
 *     → @modal slot falls back to this default.tsx → renders null
 *
 *   - /countries/ind (hard refresh or direct URL):
 *     Not a client-side navigation → intercepting route does NOT fire
 *     → @modal slot falls back to default.tsx → renders null
 *     → The full /countries/[countryId] page.tsx renders normally
 *
 *   - /countries/ind (client-side navigation from /countries):
 *     Intercepting route MATCHES → @modal/(.)countries/[countryId]/page.tsx
 *     renders the modal → default.tsx is NOT used
 *
 * INTERVIEW TIP:
 *   "When should you use default.tsx vs page.tsx in a parallel route slot?"
 *   - page.tsx: the content for a specific URL in that slot.
 *   - default.tsx: the fallback shown when no page.tsx matches.
 *   Always create default.tsx for slots that may be "empty" — it
 *   prevents unmatched slot 404 errors during navigation.
 * ============================================================
 */

// Returning null means the modal slot renders nothing by default.
// The layout's {modal} will be null — no overlay visible.
export default function ModalDefaultSlot() {
  return null
}

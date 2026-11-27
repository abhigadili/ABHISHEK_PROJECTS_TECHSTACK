/**
 * ============================================================
 * app/countries/layout.tsx — Countries Layout with Modal Slot
 * ============================================================
 *
 * INTERCEPTING ROUTES + PARALLEL ROUTES COMBINED:
 *   This layout adds a `modal` slot to the countries section.
 *   The @modal slot is used for intercepting routes — when a user
 *   clicks a country card, instead of navigating AWAY to the full
 *   country detail page, the URL updates BUT a modal overlay renders
 *   over the current countries list.
 *
 * WHY COMBINE PARALLEL ROUTES AND INTERCEPTING ROUTES?
 *   Intercepting routes need a slot to render into. Without a parallel
 *   route slot, there's nowhere to render the intercepted content.
 *
 *   Structure:
 *     app/countries/
 *       layout.tsx                          ← this file (modal slot)
 *       page.tsx                            ← countries list
 *       @modal/
 *         default.tsx                       ← null (no modal by default)
 *         (.)countries/[countryId]/
 *           page.tsx                        ← modal version of country detail
 *       [countryId]/
 *         page.tsx                          ← full country detail page
 *
 * HOW IT WORKS (the magic):
 *   1. User clicks "View India" on the countries list.
 *   2. Next.js checks: is there an intercepting route for this URL?
 *      YES: app/countries/@modal/(.)countries/[countryId]/page.tsx
 *   3. Next.js renders the modal version INSTEAD of the full page.
 *   4. URL changes to /countries/ind.
 *   5. @modal slot shows the modal; `children` shows the list behind it.
 *
 * WHEN DOES THE FULL PAGE SHOW?
 *   If the user:
 *   - Hard refreshes the page at /countries/ind
 *   - Opens /countries/ind directly in a new tab
 *   - Navigates without JavaScript
 *   Then the intercepting route does NOT apply and the full
 *   app/countries/[countryId]/page.tsx renders normally.
 *
 * THE MODAL PROP:
 *   - When the user is on /countries, modal = @modal/default.tsx = null
 *   - When the user navigates to /countries/ind CLIENT-SIDE,
 *     modal = @modal/(.)countries/[countryId]/page.tsx = the modal UI
 *
 * INTERVIEW TIP:
 *   "What's the pattern for a modal that updates the URL without
 *   losing the background page?"
 *   Answer: Intercepting routes + parallel routes.
 *   The URL updates, the background list stays mounted, and
 *   a modal overlay renders in the @modal slot.
 *   Closing the modal (router.back()) restores the previous state.
 * ============================================================
 */

// ─── Countries Layout ─────────────────────────────────────────────────────────
//
// This layout wraps all routes under /countries/.
// It accepts a `modal` parallel route slot for the intercepting route pattern.

export default function CountriesLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  // The modal slot:
  //   • Normally: null (from @modal/default.tsx — no overlay)
  //   • During client-side nav to /countries/[id]: the modal component
  modal: React.ReactNode
}) {
  return (
    <>
      {/* ── Main content ─────────────────────────────────────────────────── */}
      {/*
        `children` renders the current page:
          /countries         → app/countries/page.tsx (countries list)
          /countries/ind     → intercepted: shows modal over this page
                               (if navigated client-side)
      */}
      {children}

      {/* ── Modal slot ───────────────────────────────────────────────────── */}
      {/*
        `modal` is either:
          null    — when no intercepting route is active (default.tsx)
          <Modal> — when the user navigates to /countries/[id] client-side

        The modal renders ON TOP of {children} because it comes after
        in the DOM. In the actual modal component we use fixed positioning
        to overlay the full viewport.
      */}
      {modal}
    </>
  )
}

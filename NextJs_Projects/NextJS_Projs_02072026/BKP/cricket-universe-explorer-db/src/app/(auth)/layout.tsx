/**
 * ============================================================
 * app/(auth)/layout.tsx — Auth Route Group Layout
 * ============================================================
 *
 * ROUTE GROUPS FOR AUTH:
 *   The (auth) route group contains authentication-related pages:
 *     app/(auth)/login/page.tsx    →  URL: /login
 *     app/(auth)/register/page.tsx →  URL: /register (if added)
 *     app/(auth)/forgot-password/  →  URL: /forgot-password (if added)
 *
 *   The (auth) folder does NOT appear in the URL — it's purely
 *   for filesystem organisation and layout isolation.
 *
 * LAYOUT ISOLATION — WHY NOT USE ROOT LAYOUT?
 *   The root layout (app/layout.tsx) always renders Navbar and Footer.
 *   Auth pages (login, register) should typically NOT show the main
 *   Navbar — they're standalone focused pages designed to be distraction-free.
 *
 *   HOWEVER: In Next.js App Router, route group layouts are NESTED
 *   INSIDE the root layout, not a replacement for it. The root layout
 *   ALWAYS wraps everything — including auth pages.
 *
 *   This means the Navbar and Footer from app/layout.tsx WILL appear
 *   on auth pages in this project. To remove them, you'd need to:
 *   1. Use a SECOND root layout (multiple root layouts via route groups)
 *   2. Or conditionally hide Navbar in the root layout based on the path
 *   3. Or move Navbar out of the root layout and into non-auth layouts
 *
 * MULTIPLE ROOT LAYOUTS (Advanced):
 *   If you put layout.tsx files at:
 *     app/(auth)/layout.tsx     ← has its own <html> and <body>
 *     app/(main)/layout.tsx     ← has its own <html> and <body>
 *   And DELETE app/layout.tsx
 *   Then each group gets a completely isolated root layout.
 *
 *   Limitation: You lose the ability to share fonts, global CSS,
 *   and providers between groups (must duplicate them).
 *
 * WHAT THIS LAYOUT DOES:
 *   Provides a centred card design with cricket-themed background.
 *   In this project the root layout still wraps this, so the
 *   Navbar appears above. That's acceptable for a learning project.
 *
 * INTERVIEW TIP:
 *   "Can you completely isolate auth pages from the main navigation?"
 *   Answer: Yes, via multiple root layouts (one per route group, each
 *   with their own <html>/<body>). But this requires careful planning
 *   of shared resources (fonts, global CSS, analytics providers).
 *   For simpler cases, conditionally hide the Navbar in app/layout.tsx
 *   using usePathname() in a Client Component wrapper.
 * ============================================================
 */

// ─── Auth Layout ──────────────────────────────────────────────────────────────
//
// This layout wraps all routes inside app/(auth)/.
// Currently applies to: /login
//
// Provides:
//   - Dark cricket-themed background (bg-gray-950)
//   - Vertically and horizontally centred content
//   - Full min-height viewport coverage
//
// The root layout (Navbar/Footer) still wraps this because route group
// layouts are NESTED, not replacements, for the root layout.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // ── Centred card container ───────────────────────────────────────────────
    //
    // min-h-screen: fills at least the full viewport height.
    // flex + items-center + justify-center: centres children both ways.
    // bg-gray-950: matches the dark cricket theme.
    // p-4: padding prevents the card from touching screen edges on mobile.
    //
    // Note: The root layout <main> wraps this div (flex-1).
    // This div fills the main area and centres auth forms within it.
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {children}
    </div>
  )
}

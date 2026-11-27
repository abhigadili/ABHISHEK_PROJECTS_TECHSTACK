/**
 * ============================================================
 * app/(dashboard)/dashboard/layout.tsx — Parallel Routes Layout
 * ============================================================
 *
 * PARALLEL ROUTES (@slot convention)
 *   Parallel routes allow you to render multiple pages/components
 *   simultaneously within the same layout. Each "slot" is a
 *   subfolder prefixed with @, e.g. @stats, @recentActivity.
 *
 *   File structure:
 *     app/(dashboard)/dashboard/
 *       layout.tsx           ← this file — receives both slots
 *       page.tsx             ← renders in `children` slot
 *       @stats/
 *         page.tsx           ← renders in `stats` slot
 *       @recentActivity/
 *         page.tsx           ← renders in `recentActivity` slot
 *
 *   The layout.tsx receives each @slot as a named prop.
 *   You can compose them however you like in the layout JSX.
 *
 * HOW ARE SLOTS MATCHED?
 *   When you navigate to /dashboard:
 *   - `children` = app/(dashboard)/dashboard/page.tsx
 *   - `stats`    = app/(dashboard)/dashboard/@stats/page.tsx
 *   - `recentActivity` = app/(dashboard)/dashboard/@recentActivity/page.tsx
 *
 *   All three render simultaneously — not sequentially.
 *   Next.js fetches them in parallel, improving load time.
 *
 * WHY USE PARALLEL ROUTES?
 *   1. INDEPENDENT LOADING STATES:
 *      Each slot can have its own loading.tsx and error.tsx.
 *      If @recentActivity is slow, @stats still renders.
 *      This is impossible with regular layout + components.
 *
 *   2. INDEPENDENT NAVIGATION:
 *      Slots can be individually navigated by updating query params
 *      or via soft navigation. Useful for tab panels, split-screen UIs.
 *
 *   3. CONDITIONAL RENDERING:
 *      You can choose whether to render a slot based on auth state,
 *      feature flags, or any server-side condition.
 *
 * PARALLEL ROUTES vs LAYOUT WITH COMPONENTS:
 *   Layout + Components:
 *     export default function Layout({ children }) {
 *       return <div><children /><StatsPanel /><RecentActivity /></div>
 *     }
 *     Problem: StatsPanel and RecentActivity block the whole layout.
 *     Their loading state is tied to the slowest component.
 *
 *   Parallel Routes:
 *     Each slot loads independently with its own Suspense boundary.
 *     If @recentActivity has a 3s DB call, @stats (100ms) renders first.
 *
 * DEFAULT.TSX:
 *   When navigating to a URL that doesn't match a slot's page,
 *   Next.js looks for default.tsx in that slot. Without it, the
 *   slot is "unmatched" and causes a 404. Always create default.tsx
 *   for slots that may not match every URL.
 *
 * INTERVIEW TIP:
 *   "What's the difference between parallel routes and rendering
 *   multiple components in a layout?"
 *   → Parallel routes render independently with their own:
 *     - Loading states (loading.tsx per slot)
 *     - Error boundaries (error.tsx per slot)
 *     - Navigation history (soft navigation)
 *   Regular components block together — one slow component delays all.
 * ============================================================
 */

// ─── Dashboard Page Layout with Parallel Route Slots ─────────────────────────
//
// This layout receives THREE props:
//   children      — the dashboard page.tsx itself
//   stats         — the @stats/page.tsx slot
//   recentActivity — the @recentActivity/page.tsx slot
//
// All three are React.ReactNode — they may be Server or Client Components.
// Next.js renders them in parallel before this layout receives them.

export default function DashboardLayout({
  children,
  stats,
  recentActivity,
}: {
  children: React.ReactNode
  stats: React.ReactNode
  recentActivity: React.ReactNode
}) {
  return (
    // ── Outer wrapper ──────────────────────────────────────────────────────────
    <div className="bg-gray-950 min-h-full">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 px-6 py-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          Your cricket universe at a glance — powered by parallel routes.
        </p>
      </div>

      {/* ── Educational note ─────────────────────────────────────────────── */}
      {/*
        This banner explains to learners what they're looking at.
        In a real production app you'd remove this.
      */}
      <div className="mx-6 mt-6 rounded-xl border border-blue-800 bg-blue-950/40 px-5 py-4">
        <p className="text-blue-300 text-sm font-semibold mb-1">
          Parallel Routes Demo
        </p>
        <p className="text-blue-400 text-xs leading-relaxed">
          This dashboard uses THREE parallel route slots rendered simultaneously:
          <code className="mx-1 bg-blue-900 px-1.5 rounded text-blue-200">children</code>
          (main content),
          <code className="mx-1 bg-blue-900 px-1.5 rounded text-blue-200">@stats</code>
          (stats panel), and
          <code className="mx-1 bg-blue-900 px-1.5 rounded text-blue-200">@recentActivity</code>
          (activity feed).
          Each loads independently with its own Suspense boundary.
        </p>
      </div>

      {/* ── Main grid layout ─────────────────────────────────────────────── */}
      {/*
        grid-cols-3: 3 equal columns on desktop.
        The main content area (children) spans 2 columns.
        The right panel (stats + recentActivity) spans 1 column.

        This is the key parallel routes composition: we take the
        independent slot props and lay them out however we want.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">

        {/* ── Children slot (col-span-2): main dashboard content ─────────── */}
        {/*
          The `children` prop holds the output of page.tsx.
          In parallel routes, `children` is just another slot —
          it maps to the implicit default slot (no @folder needed).
        */}
        <div className="lg:col-span-2 space-y-6">
          {children}
        </div>

        {/* ── Side panel slots (col-span-1): stats + recent activity ──────── */}
        {/*
          These two slots render in the same column, stacked vertically.
          They loaded in PARALLEL — not sequentially.
          If @stats loaded in 50ms and @recentActivity in 500ms,
          @stats appears immediately while @recentActivity shows its
          loading skeleton (if it has one).
        */}
        <div className="space-y-6">
          {/* @stats slot */}
          {stats}

          {/* @recentActivity slot */}
          {recentActivity}
        </div>

      </div>
    </div>
  )
}

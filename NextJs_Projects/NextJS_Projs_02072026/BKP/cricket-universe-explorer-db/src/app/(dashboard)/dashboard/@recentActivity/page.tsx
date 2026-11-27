/**
 * ============================================================
 * app/(dashboard)/dashboard/@recentActivity/page.tsx
 * — Recent Activity Panel (Parallel Route Slot)
 * ============================================================
 *
 * PARALLEL ROUTE SLOT: @recentActivity
 *   This file is the second parallel route slot on the /dashboard page.
 *   It is passed as the `recentActivity` prop to the dashboard layout.
 *
 *   File:  app/(dashboard)/dashboard/@recentActivity/page.tsx
 *   Slot:  `recentActivity` prop in DashboardLayout
 *   URL:   /dashboard (same URL as all other dashboard slots)
 *
 * INDEPENDENT ERROR HANDLING:
 *   Add @recentActivity/error.tsx to catch errors only in THIS slot.
 *   If the recent activity feed fails, the @stats slot is unaffected.
 *   This is the killer feature of parallel routes over layout components.
 *
 * MOCK DATA:
 *   The activity list is hard-coded here for demonstration.
 *   In a real app, you'd fetch from an activity log table:
 *     const activities = await db.activityLog.findMany({
 *       where: { userId },
 *       orderBy: { createdAt: 'desc' },
 *       take: 5,
 *     })
 *
 * SLOT NAMING:
 *   The folder name @recentActivity maps directly to the prop name
 *   `recentActivity` in the layout (camelCase from the folder name).
 *   Next.js strips the @ prefix and uses the remainder as the prop name.
 *
 * INTERVIEW TIP:
 *   "How many parallel route slots can a layout have?"
 *   Answer: As many as you need — there's no limit. Each @folder
 *   becomes one named prop in the layout. This scales well for
 *   complex dashboard UIs with many independent data panels.
 * ============================================================
 */

// ─── Recent Activity Panel ────────────────────────────────────────────────────
//
// Mock activity feed. In production this would be an async Server Component
// making a database call, with its own loading.tsx skeleton.

export default function RecentActivityPanel() {
  // ── Mock activity data ────────────────────────────────────────────────────
  //
  // In a real app: const activities = await fetchRecentActivity(userId)
  // The component would be `async` and the data would come from a DB/API.

  const activities = [
    {
      id: 1,
      action: 'Viewed',
      subject: 'India vs Australia match stats',
      icon: '👁️',
      time: '2 min ago',
      type: 'view',
    },
    {
      id: 2,
      action: 'Favorited',
      subject: 'Chennai Super Kings',
      icon: '⭐',
      time: '15 min ago',
      type: 'favorite',
    },
    {
      id: 3,
      action: 'Explored',
      subject: 'IPL — Indian Premier League',
      icon: '🔍',
      time: '1 hr ago',
      type: 'explore',
    },
    {
      id: 4,
      action: 'Saved',
      subject: 'MS Dhoni player profile',
      icon: '📌',
      time: '3 hr ago',
      type: 'save',
    },
    {
      id: 5,
      action: 'Read',
      subject: 'Next.js routing concepts docs',
      icon: '📖',
      time: 'Yesterday',
      type: 'read',
    },
  ]

  // ── Type → colour mapping ─────────────────────────────────────────────────
  const typeColors: Record<string, string> = {
    view:     'text-blue-400',
    favorite: 'text-yellow-400',
    explore:  'text-emerald-400',
    save:     'text-purple-400',
    read:     'text-orange-400',
  }

  return (
    // ── Activity card ──────────────────────────────────────────────────────────
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">

      {/* Card header */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🕐</span>
          <h2 className="text-white font-semibold text-sm">Recent Activity</h2>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          Parallel route slot: <code className="text-blue-400">@recentActivity</code>
        </p>
      </div>

      {/* Activity list */}
      <ul className="divide-y divide-gray-800" role="list">
        {activities.map((activity) => (
          <li key={activity.id} className="px-5 py-3 flex items-start gap-3">
            {/* Icon */}
            <span
              className="text-sm flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              {activity.icon}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className={`font-semibold ${typeColors[activity.type] ?? 'text-gray-300'}`}>
                  {activity.action}
                </span>{' '}
                <span className="text-gray-400">{activity.subject}</span>
              </p>
              <p className="text-gray-600 text-xs mt-0.5">{activity.time}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-800">
        <p className="text-gray-600 text-xs">
          Loads independently — can have its own error.tsx
        </p>
      </div>

    </div>
  )
}

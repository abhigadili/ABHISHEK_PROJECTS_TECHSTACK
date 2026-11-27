
/**
 * PARALLEL ROUTES: `@kpis`, `@charts` and `@events` are NAMED SLOTS. Each is its own route tree with its own loading.tsx / error.tsx,
 * fetched in parallel and streamed independently — a slow or failing chart never blocks (or breaks) the KPI cards. The layout receives
 * every slot as a prop next to `children` and decides where to place them. Slots keep their state on navigation; `default.tsx` renders
 * a slot when the current URL has no match for it.
 */
export default function DashboardAreaLayout({ children, kpis, charts, events }: LayoutProps<'/dashboard'>) {
  return (
    <div className="space-y-6">
      {children}
      <section aria-label="Key figures">{kpis}</section>
      <section aria-label="Charts">{charts}</section>
      <section aria-label="Upcoming events">{events}</section>
    </div>
  );
}

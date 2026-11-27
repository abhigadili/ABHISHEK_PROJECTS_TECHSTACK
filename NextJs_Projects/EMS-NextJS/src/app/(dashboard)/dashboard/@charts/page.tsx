import { getDashboard } from '@/lib/server/dashboard';
import { DashboardCharts } from '@/features/dashboard/ChartsLazy';
import { Alert } from '@/components/common/ui';
import { humanize } from '@/lib/utils/format';

/** Slot @charts — the server shapes the data into small serialisable arrays; the chart itself is a lazily-loaded Client Component island. */
export default async function Charts() {
  const d = await getDashboard();
  if (!d) return <Alert kind="info">Company charts are available to managers and HR. Your personal figures are shown above.</Alert>;
  return (
    <DashboardCharts
      headcount={d.headcountByDepartment.map((x) => ({ name: x.department, value: x.headcount }))}
      attendance={Object.entries(d.attendanceToday).map(([k, v]) => ({ name: humanize(k), value: v }))}
      leave={Object.entries(d.leaveThisYear).map(([k, v]) => ({ name: humanize(k), requests: v.requests, days: v.days }))}
    />
  );
}

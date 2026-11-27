import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/feedback/states';

export const SERIES = ['#4f46e5', '#0ea5a4', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#0284c7', '#ec4899'];
function useAxis() { const { resolved } = useThemeMode(); return { grid: resolved === 'dark' ? '#2a3150' : '#e4e7ee', text: resolved === 'dark' ? '#9aa4c0' : '#667085', tipBg: resolved === 'dark' ? '#171c2e' : '#fff' }; }
const tip = (c: ReturnType<typeof useAxis>) => ({ contentStyle: { background: c.tipBg, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 12 }, labelStyle: { fontWeight: 600 } });

/** Card with loading / error / empty states around a responsive chart. */
export function ChartCard({ title, actions, loading, error, onRetry, empty, height = 260, children }: { title: ReactNode; actions?: ReactNode; loading?: boolean; error?: unknown; onRetry?: () => void; empty?: boolean; height?: number; children: ReactNode }) {
  return (
    <Card className="h-100">
      <CardHeader><CardTitle>{title}</CardTitle>{actions}</CardHeader>
      <CardBody>
        {loading ? <LoadingBlock rows={5} /> : error ? <ErrorState error={error} onRetry={onRetry} /> : empty ? <EmptyState /> : <div style={{ width: '100%', height, minWidth: 0 }}>{children}</div>}
      </CardBody>
    </Card>
  );
}
export function BarSeries({ data, x, keys, stacked, colors }: { data: any[]; x: string; keys: { key: string; label: string }[]; stacked?: boolean; colors?: string[] }) {
  const c = useAxis();
  return (
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
      <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={x} tick={{ fill: c.text, fontSize: 11 }} interval={0} tickFormatter={(v) => (String(v).length > 12 ? String(v).slice(0, 11) + '…' : v)} />
      <YAxis tick={{ fill: c.text, fontSize: 11 }} allowDecimals={false} />
      <Tooltip {...tip(c)} cursor={{ fill: 'rgba(120,120,160,.08)' }} />
      {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} stackId={stacked ? 's' : undefined} fill={(colors ?? SERIES)[i % SERIES.length]} radius={stacked ? 0 : [4, 4, 0, 0]} maxBarSize={44} isAnimationActive />)}
    </BarChart></ResponsiveContainer>
  );
}
export function LineSeries({ data, x, keys }: { data: any[]; x: string; keys: { key: string; label: string }[] }) {
  const c = useAxis();
  return (
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
      <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={x} tick={{ fill: c.text, fontSize: 11 }} />
      <YAxis tick={{ fill: c.text, fontSize: 11 }} allowDecimals={false} />
      <Tooltip {...tip(c)} /><Legend wrapperStyle={{ fontSize: 12 }} />
      {keys.map((k, i) => <Line key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={SERIES[i % SERIES.length]} strokeWidth={2.2} dot={{ r: 3 }} />)}
    </LineChart></ResponsiveContainer>
  );
}
export function DonutSeries({ data, name = 'name', value = 'value' }: { data: any[]; name?: string; value?: string }) {
  const c = useAxis();
  return (
    <ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={data} dataKey={value} nameKey={name} innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none">{data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}</Pie>
      <Tooltip {...tip(c)} /><Legend wrapperStyle={{ fontSize: 12 }} />
    </PieChart></ResponsiveContainer>
  );
}

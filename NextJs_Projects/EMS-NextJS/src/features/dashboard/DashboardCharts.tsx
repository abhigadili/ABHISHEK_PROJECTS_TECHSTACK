'use client';
import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/common/ui';

interface Slice { name: string; value: number }
const COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#dc2626', '#16a34a'];

/** `memo`: props are plain serialisable arrays from the server; the chart re-renders only if the numbers actually change. */
function Charts({ headcount, attendance, leave }: { headcount: Slice[]; attendance: Slice[]; leave: { name: string; requests: number; days: number }[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card><h2 className="mb-3 font-semibold">Headcount by department</h2>
        {headcount.length === 0 ? <p className="text-sm text-muted">No departments yet.</p> : (
          <div role="img" aria-label={`Bar chart of headcount: ${headcount.map((h) => `${h.name} ${h.value}`).join(', ')}`} className="h-64">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={headcount}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" name="Employees" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>)}
      </Card>
      <Card><h2 className="mb-3 font-semibold">Attendance today</h2>
        {attendance.length === 0 ? <p className="text-sm text-muted">No attendance recorded today.</p> : (
          <div role="img" aria-label={`Pie chart of attendance: ${attendance.map((a) => `${a.name} ${a.value}`).join(', ')}`} className="h-64">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={attendance} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>{attendance.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
          </div>)}
      </Card>
      <Card className="lg:col-span-2"><h2 className="mb-3 font-semibold">Leave this year</h2>
        {leave.length === 0 ? <p className="text-sm text-muted">No leave requests this year.</p> : (
          <div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={leave}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="requests" fill="#0d9488" radius={[6, 6, 0, 0]} /><Bar dataKey="days" fill="#d97706" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>)}
      </Card>
    </div>
  );
}
export default memo(Charts);

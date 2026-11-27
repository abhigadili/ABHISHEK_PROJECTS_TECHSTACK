import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PartyPopper } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { NativeSelect } from '@/components/ui/input';
import { Calendar, type CalEvent } from '@/components/common/Calendar';
import { CrudSection } from '@/components/op/CrudSection';
import { OpView } from '@/components/op/OpView';
import { useOp } from '@/components/op/useOp';
import { useRefOptions } from '@/components/op/refs';
import { StatusBadge } from '@/components/common/values';
import { useFormat } from '@/contexts/LanguageContext';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

function Filters({ year, setYear, loc, setLoc, dep, setDep }: any) {
  const { t } = useTranslation(); const locs = useRefOptions('location'); const deps = useRefOptions('department'); const years = useOp<any[]>('holiday.list');
  const ys = [...new Set([new Date().getFullYear(), ...(years.data ?? []).map((y) => y.year)])].sort();
  return (
    <div className="mb-3 d-flex flex-wrap gap-2">
      <NativeSelect className="w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('common.year')}>{ys.map((y) => <option key={y}>{y}</option>)}</NativeSelect>
      <NativeSelect className="w-auto" value={loc} onChange={(e) => setLoc(e.target.value)} aria-label={t('common.location')}><option value="">{t('common.all')} · {t('common.location')}</option>{locs.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
      <NativeSelect className="w-auto" value={dep} onChange={(e) => setDep(e.target.value)} aria-label={t('common.department')}><option value="">{t('common.all')} · {t('common.department')}</option>{deps.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
    </div>
  );
}
export default function HolidaysPage() {
  const { t } = useTranslation(); const f = useFormat();
  const [year, setYear] = useState(new Date().getFullYear()); const [loc, setLoc] = useState(''); const [dep, setDep] = useState('');
  const query = { locationId: loc || undefined, departmentId: dep || undefined };
  const [range, setRange] = useState<[string, string]>(['', '']);
  const rng = useOp<any[]>('holiday.range', { query: { from: range[0], to: range[1], ...query } }, { enabled: !!range[0] });
  const cal = useOp<any>('holiday.calendar', { path: { year }, query });
  const events: CalEvent[] = (rng.data ?? []).map((h) => ({ date: h.holidayDate, label: h.name, title: `${h.name} (${h.type})`, tone: h.type === 'MANDATORY' ? 'danger' : h.type === 'OPTIONAL' ? 'info' : 'warning' }));
  const crud = (
    <CrudSection title={`${t('hr.holidays.title')} · ${year}`} list={{ op: 'holiday.byYear', query: { year, ...query } }} tableId="holidays"
      create={{ op: 'holiday.create', initial: { holidayYear: year } }} update={{ op: 'holiday.update', path: (r) => ({ id: r.id }) }} remove={{ op: 'holiday.delete', path: (r) => ({ id: r.id }) }} view={{ op: 'holiday.get', path: (r) => ({ id: r.id }) }}
      columns={[{ key: 'name' }, { key: 'holidayDate', sortable: true }, { key: 'type', cell: (r) => <StatusBadge value={r.type} /> }, { key: 'description', defaultHidden: true }, { key: 'scopes', cell: (r) => (r.scopes?.length ? `${r.scopes.length} scope(s)` : 'All') }]} />
  );
  return (
    <>
      <PageHeader title={t('hr.holidays.title')} description={t('hr.holidays.sub')} icon={<PartyPopper size={20} />} />
      <Filters {...{ year, setYear, loc, setLoc, dep, setDep }} />
      <Tabs tabs={[
        { key: 'calendar', label: t('hr.leave.calendar'), content: <Calendar events={events} onRange={(a, b) => setRange((r) => (r[0] === a && r[1] === b ? r : [a, b]))} /> },
        { key: 'list', label: t('common.view'), content: crud },
        { key: 'upcoming', label: t('hr.dashboard.upcomingHolidays'), content: <OpView op="holiday.upcoming" query={{ limit: 10, ...query }} /> },
        { key: 'year', label: `${year}`, content: (
          <Card><CardHeader><CardTitle>{year}</CardTitle></CardHeader><CardBody>
            {cal.data && <div className="mb-3 d-flex gap-2 flex-wrap">{Object.entries(cal.data.months ?? cal.data.byMonth ?? {}).map(([m, list]: any) => <div key={m} className="rounded-md border p-2" style={{ minWidth: 180, borderColor: 'var(--hr-border)' }}><div className="fw-semibold" style={{ fontSize: 12 }}>{m}</div>{(list as any[]).map((h) => <div key={h.id} style={{ fontSize: 12 }}>{f.date(h.holidayDate)} · {h.name}</div>)}</div>)}</div>}
            <OpView op="holiday.calendar" path={{ year }} query={query} bare hide={['months', 'byMonth']} /></CardBody></Card>) },
        { key: 'years', label: 'Holiday years', content: <CrudSection title="Holiday years" list={{ op: 'holiday.list' }} create={{ op: 'holiday.createHolidayYears' }} update={{ op: 'holiday.updateHolidayYears', path: (r) => ({ id: r.id }) }} /> },
      ]} />
    </>
  );
}

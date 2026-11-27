import { Select } from '@/components/ui/Field';
import { useStationsQuery } from '@/store/api';
import type { SelectHTMLAttributes } from 'react';

/** Station <select> backed by RTK Query's cached /stations list */
export function StationPicker({ placeholder = 'Select station', ...p }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string }) {
  const { data = [], isLoading } = useStationsQuery();
  return <Select {...p} disabled={isLoading || p.disabled}><option value="">{isLoading ? 'Loading…' : placeholder}</option>{data.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</Select>;
}

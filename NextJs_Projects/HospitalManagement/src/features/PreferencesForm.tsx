'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';

/** Talks to the /api/preferences Route Handler (GET/POST/DELETE) with Axios; the preference lives in a cookie set by the handler. */
export function PreferencesForm() {
  const [pageSize, setPageSize] = useState('20');
  const [density, setDensity] = useState('comfortable');
  const { mode, toggle } = useTheme();
  useEffect(() => { void axios.get('/api/preferences').then((r) => { setPageSize(String(r.data.pageSize)); setDensity(r.data.density); }).catch(() => undefined); }, []);
  const save = async () => { try { await axios.post('/api/preferences', { pageSize: Number(pageSize), density }); emitToast({ kind: 'success', text: 'Preferences saved' }); } catch { emitToast({ kind: 'error', text: 'Could not save preferences' }); } };
  const clear = async () => { await axios.delete('/api/preferences'); setPageSize('20'); setDensity('comfortable'); emitToast({ kind: 'info', text: 'Preferences reset' }); };
  return (
    <div className="max-w-md space-y-3"><Field label="Rows per page" htmlFor="ps"><Select id="ps" value={pageSize} onChange={(e) => setPageSize(e.target.value)}><option>10</option><option>20</option><option>50</option></Select></Field><Field label="Density" htmlFor="dn"><Select id="dn" value={density} onChange={(e) => setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></Select></Field>
      <div className="flex flex-wrap items-center gap-2"><Button onClick={save}>Save preferences</Button><Button variant="ghost" onClick={clear}>Reset</Button><Button variant="outline" onClick={toggle}>Switch to {mode === 'dark' ? 'light' : 'dark'} mode</Button></div></div>
  );
}

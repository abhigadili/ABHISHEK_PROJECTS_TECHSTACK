'use client';
import { Download, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, PageHeader } from '@/components/ui';
import { ApiError, api, uploadWithProgress } from '@/lib/api';
import { errMsg } from '@/hooks/useApi';

export default function ImportPage() {
  const toast = useToast(); const input = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<{ line: number; message: string }[] | null>(null); const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);
  const send = async (dry: boolean) => {
    if (!file) return; setBusy(true); setIssues(null); setMsg(null);
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await uploadWithProgress<{ imported: number; rows?: number; valid?: boolean }>('POST', `/books/import${dry ? '?dryRun=1' : ''}`, fd);
      if (dry) setMsg({ tone: 'green', text: `Validation passed: ${r.rows} row(s) are ready to import.` });
      else { setMsg({ tone: 'green', text: `Imported ${r.imported} book(s).` }); toast.success('Import complete'); setFile(null); if (input.current) input.current.value = ''; }
    } catch (e) { if (e instanceof ApiError && Array.isArray(e.details)) { setIssues(e.details as never); setMsg({ tone: 'red', text: e.message }); } else setMsg({ tone: 'red', text: errMsg(e) }); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Bulk import books" subtitle="Upload a CSV; every row is validated first and nothing is imported unless the whole file is valid." actions={<Button variant="secondary" onClick={() => api.download('/books/import/template', 'books-import-template.csv')}><Download className="h-4 w-4" />Download template</Button>} />
      <Card>
        <div className="space-y-4"><p className="text-sm text-slate-600">Required columns: <code>title</code>, <code>authors</code> (separate several with <code>;</code>). Optional: subtitle, categories, publisher, isbn10, isbn13, publication_year, language, pages, format, copies, shelf, description. Unknown authors, categories and publishers are created. Max 1000 rows.</p>
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setIssues(null); setMsg(null); }} />
          <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" onClick={() => input.current?.click()}><FileUp className="h-4 w-4" />{file ? file.name : 'Choose CSV file'}</Button><Button variant="secondary" disabled={!file} loading={busy} onClick={() => send(true)}>Validate only</Button><Button disabled={!file} loading={busy} onClick={() => send(false)}>Import</Button></div>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {issues && <div className="max-h-72 overflow-auto rounded-lg border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="th">Row</th><th className="th">Problem</th></tr></thead><tbody>{issues.map((i, k) => <tr key={k} className="border-t border-slate-100"><td className="td w-20">{i.line}</td><td className="td">{i.message}</td></tr>)}</tbody></table></div>}
        </div>
      </Card>
    </>
  );
}

/** File helpers. SheetJS / jsPDF are loaded lazily (dynamic import) so they stay out of the initial bundle. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
const guard = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; }; // CSV formula-injection guard
export function toCsv(headers: string[], rows: unknown[][]) {
  const esc = (v: unknown) => `"${guard(v).replace(/"/g, '""')}"`;
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}
export function exportCsv(name: string, headers: string[], rows: unknown[][]) { saveBlob(new Blob(['﻿' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), `${name}.csv`); }
export async function exportXlsx(name: string, headers: string[], rows: unknown[][]) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => r.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)))]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${name}.xlsx`);
}
export async function exportPdf(name: string, headers: string[], rows: unknown[][]) {
  const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
  (autoTable as any).default(doc, { head: [headers], body: rows.map((r) => r.map((v) => (v == null ? '' : String(v)))), styles: { fontSize: 8 } });
  doc.save(`${name}.pdf`);
}

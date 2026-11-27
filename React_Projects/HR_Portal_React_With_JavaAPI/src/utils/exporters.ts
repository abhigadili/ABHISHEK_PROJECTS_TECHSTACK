import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Client-side export of exactly the rows/columns the user is allowed to see on screen (no extra data is fetched). */
export interface ExportCol { key: string; header: string }
const flat = (v: unknown): string | number | boolean => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as any));
const stamp = () => new Date().toISOString().slice(0, 10);
function matrix(rows: any[], cols: ExportCol[]) { return rows.map((r) => cols.map((c) => flat(c.key.split('.').reduce((a, k) => a?.[k], r)))); }
export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function exportCsv(rows: any[], cols: ExportCol[], name = 'export') {
  const esc = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; /* CSV-injection guard */ return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map((c) => esc(c.header)).join(','), ...matrix(rows, cols).map((r) => r.map(esc).join(','))].join('\n');
  saveBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${name}-${stamp()}.csv`);
}
export function exportExcel(rows: any[], cols: ExportCol[], name = 'export') {
  const ws = XLSX.utils.aoa_to_sheet([cols.map((c) => c.header), ...matrix(rows, cols)]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${name}-${stamp()}.xlsx`);
}
export function exportPdf(rows: any[], cols: ExportCol[], name = 'export', title?: string) {
  const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(13); doc.text(title ?? name, 14, 14);
  autoTable(doc, { startY: 20, head: [cols.map((c) => c.header)], body: matrix(rows, cols).map((r) => r.map(String)), styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] } });
  doc.save(`${name}-${stamp()}.pdf`);
}

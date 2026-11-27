import { parentPort, workerData } from 'node:worker_threads';
import PDFDocument from 'pdfkit';

export interface PdfSection { heading?: string; pairs?: [string, string][]; table?: { columns: string[]; rows: (string | number)[][] } }
export interface PdfDoc { title: string; subtitle?: string; sections: PdfSection[]; footer?: string }

const doc = new PDFDocument({ size: 'A4', margin: 48 });
const chunks: Buffer[] = [];
doc.on('data', (c: Buffer) => chunks.push(c));
doc.on('end', () => parentPort!.postMessage(Buffer.concat(chunks)));

const d = workerData as PdfDoc;
doc.fontSize(20).text(d.title, { align: 'center' });
if (d.subtitle) doc.moveDown(0.3).fontSize(11).fillColor('#555').text(d.subtitle, { align: 'center' }).fillColor('#000');
doc.moveDown();
for (const s of d.sections) {
  if (s.heading) { doc.moveDown(0.5).fontSize(13).fillColor('#1a3d7c').text(s.heading).fillColor('#000'); doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#ccc').stroke(); doc.moveDown(0.3); }
  for (const [k, v] of s.pairs ?? []) { doc.fontSize(10).text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(String(v)).font('Helvetica'); }
  if (s.table) {
    const cols = s.table.columns; const w = 499 / cols.length;
    const row = (cells: (string | number)[], bold: boolean): void => {
      const y = doc.y; doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      cells.forEach((c, i) => doc.text(String(c), 48 + i * w, y, { width: w - 4, align: i === 0 ? 'left' : 'right' }));
      doc.y = y + 16; doc.x = 48;
    };
    row(cols, true);
    for (const r of s.table.rows) row(r, false);
    doc.font('Helvetica');
  }
}
if (d.footer) doc.moveDown(2).fontSize(8).fillColor('#777').text(d.footer, { align: 'center' });
doc.end();

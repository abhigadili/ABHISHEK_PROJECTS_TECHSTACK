import { csvCell, toCsv } from './csv';

describe('csv utils', () => {
  it('quotes fields containing commas, quotes or newlines (RFC 4180)', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('neutralises spreadsheet formula injection', () => {
    for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) expect(csvCell(evil).replace(/"/g, '')).toMatch(/^'/);
  });

  it('builds header + rows with CRLF line endings', () => {
    const csv = toCsv([{ n: 'Eve', d: 'Eng, Core' }], [{ header: 'Name', value: (r) => r.n }, { header: 'Dept', value: (r) => r.d }]);
    expect(csv).toBe('Name,Dept\r\nEve,"Eng, Core"');
  });
});

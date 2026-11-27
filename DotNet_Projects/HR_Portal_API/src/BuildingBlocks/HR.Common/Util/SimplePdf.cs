using System.Text;

namespace HR.Common.Util;

/// <summary>Minimal dependency-free PDF writer (Helvetica text, lines, simple tables) used for payslips and statements.</summary>
public sealed class SimplePdf
{
    private readonly List<StringBuilder> _pages = [new StringBuilder()];
    private double _y = 800;
    private const double Left = 50, Bottom = 60;

    private StringBuilder Page => _pages[^1];

    private void EnsureSpace(double h) { if (_y - h < Bottom) { _pages.Add(new StringBuilder()); _y = 800; } }

    private static string Esc(string s) => new string(s.Select(c => c < 32 || c > 126 ? '?' : c).ToArray()).Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");

    public SimplePdf Title(string text) { EnsureSpace(30); Page.Append($"BT /F2 18 Tf {Left} {_y} Td ({Esc(text)}) Tj ET\n"); _y -= 28; return this; }

    public SimplePdf Heading(string text) { EnsureSpace(24); _y -= 6; Page.Append($"BT /F2 12 Tf {Left} {_y} Td ({Esc(text)}) Tj ET\n"); _y -= 6; Rule(); return this; }

    public SimplePdf Text(string text, bool bold = false) { EnsureSpace(16); Page.Append($"BT /{(bold ? "F2" : "F1")} 10 Tf {Left} {_y} Td ({Esc(text)}) Tj ET\n"); _y -= 15; return this; }

    public SimplePdf Row(string left, string right, bool bold = false)
    {
        EnsureSpace(16);
        var f = bold ? "F2" : "F1";
        Page.Append($"BT /{f} 10 Tf {Left} {_y} Td ({Esc(left)}) Tj ET\n");
        Page.Append($"BT /{f} 10 Tf 400 {_y} Td ({Esc(right)}) Tj ET\n");
        _y -= 15;
        return this;
    }

    public SimplePdf Rule() { EnsureSpace(8); Page.Append($"0.6 w {Left} {_y} m 545 {_y} l S\n"); _y -= 10; return this; }

    public SimplePdf Gap(double h = 10) { _y -= h; return this; }

    public byte[] ToBytes()
    {
        var objs = new List<string>();
        var n = _pages.Count;
        // 1 catalog, 2 pages, 3 F1, 4 F2, then per page: page obj + content obj
        objs.Add("<< /Type /Catalog /Pages 2 0 R >>");
        objs.Add($"<< /Type /Pages /Kids [{string.Join(' ', Enumerable.Range(0, n).Select(i => $"{5 + i * 2} 0 R"))}] /Count {n} >>");
        objs.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
        objs.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
        for (var i = 0; i < n; i++)
        {
            objs.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {6 + i * 2} 0 R >>");
            var c = _pages[i].ToString();
            objs.Add($"<< /Length {Encoding.ASCII.GetByteCount(c)} >>\nstream\n{c}endstream");
        }
        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objs.Count; i++) { offsets.Add(sb.Length); sb.Append($"{i + 1} 0 obj\n{objs[i]}\nendobj\n"); }
        var xref = sb.Length;
        sb.Append($"xref\n0 {objs.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append($"{o:D10} 00000 n \n");
        sb.Append($"trailer\n<< /Size {objs.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }
}

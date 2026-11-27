using System.Globalization;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.Common.Storage;
using HR.Common.Util;
using HR.PayrollService.Data;
using HR.PayrollService.DTOs;
using HR.PayrollService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.PayrollService.Services;

public interface IPayslipService
{
    Task<int> GenerateForRunAsync(string runId, string month, CancellationToken ct);
    Task<List<PayslipDto>> ListForEmployeeAsync(string employeeId, int? year, CancellationToken ct);
    Task<PayslipDto?> LatestAsync(string employeeId, CancellationToken ct);
    Task<(Stream Stream, string FileName, long Size)> OpenAsync(string payslipId, CancellationToken ct);
}

public sealed class PayslipService(PayrollDbContext db, IFileStorage storage, ICurrentUser user, IEventPublisher events, IAuditWriter audit, ILogger<PayslipService> log) : IPayslipService
{
    private static string Fmt(decimal n) => n.ToString("N2", CultureInfo.InvariantCulture);
    private static PayslipDto ToDto(Payslip p) => new(p.Id, p.EmployeeId, p.PayrollMonth, p.FileName, p.SizeBytes, p.GeneratedAt);

    private sealed record Rendered(PayrollEntry Entry, string FileName, byte[] Pdf);

    /// <summary>PDF rendering is CPU-bound: it runs in parallel on the thread pool (bounded); persistence stays sequential on the request's DbContext.</summary>
    public async Task<int> GenerateForRunAsync(string runId, string month, CancellationToken ct)
    {
        var entries = await db.PayrollEntries.AsNoTracking().Where(e => e.RunId == runId).OrderBy(e => e.EmployeeName).Take(5000).ToListAsync(ct);
        var done = await db.Payslips.Where(p => p.RunId == runId).Select(p => p.EntryId).ToListAsync(ct);
        var todo = entries.Where(e => !done.Contains(e.Id)).ToList();            // idempotent
        var lines = (await db.PayrollEntryLines.AsNoTracking().Where(l => todo.Select(t => t.Id).Contains(l.EntryId)).ToListAsync(ct)).ToLookup(l => l.EntryId);
        var emails = new Dictionary<string, string?>();
        var rendered = new System.Collections.Concurrent.ConcurrentBag<Rendered>();
        await Parallel.ForEachAsync(todo, new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct }, (e, _) =>
        {
            rendered.Add(new Rendered(e, $"payslip-{e.EmployeeCode ?? e.EmployeeId}-{month}.pdf", Render(e, lines[e.Id].ToList(), month)));
            return ValueTask.CompletedTask;
        });
        var count = 0;
        foreach (var r in rendered)
        {
            try
            {
                var stored = await storage.SaveAsync($"payslips/{month}", r.FileName, r.Pdf, ct);
                var p = new Payslip { EmployeeId = r.Entry.EmployeeId, EntryId = r.Entry.Id, RunId = runId, PayrollMonth = month, FileName = r.FileName, StoragePath = stored.StoragePath, Sha256 = stored.Sha256, SizeBytes = stored.SizeBytes, GeneratedAt = DateTime.UtcNow };
                db.Payslips.Add(p);
                var parts = month.Split('-');
                events.Publish(Topics.PayslipGenerated, r.Entry.EmployeeId, new PayslipGeneratedEvent(p.Id, r.Entry.EmployeeId, r.Entry.EmployeeName ?? "", null, int.Parse(parts[0]), int.Parse(parts[1]), r.Entry.Net, stored.StoragePath, r.FileName, stored.SizeBytes));
                await db.SaveChangesAsync(ct);
                count++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { log.LogError(ex, "Payslip generation failed for {Employee}", r.Entry.EmployeeId); }
        }
        return count;
    }

    private static byte[] Render(PayrollEntry e, List<PayrollEntryLine> lines, string month)
    {
        var pdf = new SimplePdf().Title("Payslip").Text($"Pay period {month}").Gap(6)
            .Heading("Employee").Row("Name", e.EmployeeName ?? "-").Row("Employee code", e.EmployeeCode ?? "-").Row("Paid days", $"{e.PaidDays:0.##} / {e.WorkingDays:0.##}").Row("Loss of pay days", $"{e.LopDays:0.##}")
            .Heading("Earnings");
        foreach (var l in lines.Where(l => l.Type == "EARNING")) pdf.Row(l.ComponentName, Fmt(l.Amount));
        pdf.Row("Gross earnings", Fmt(e.Gross), bold: true).Heading("Deductions");
        foreach (var l in lines.Where(l => l.Type == "DEDUCTION")) pdf.Row(l.ComponentName, Fmt(l.Amount));
        pdf.Row("Total deductions", Fmt(e.Deductions), bold: true).Heading("Net pay").Row("Net payable", Fmt(Math.Round(e.Net, 2)), bold: true).Gap(20)
            .Text($"System generated payslip - {DateTime.UtcNow:yyyy-MM-dd} - confidential");
        return pdf.ToBytes();
    }

    public async Task<List<PayslipDto>> ListForEmployeeAsync(string employeeId, int? year, CancellationToken ct)
    {
        if (user.EmployeeId != employeeId && !user.HasPermission(Perm.PayslipViewAll) && !user.IsSuperAdmin) throw new ForbiddenException("You may only view your own payslips");
        var prefix = year is null ? null : $"{year}-";
        var q = db.Payslips.AsNoTracking().Where(p => p.EmployeeId == employeeId);
        if (prefix is not null) q = q.Where(p => p.PayrollMonth.StartsWith(prefix));
        return (await q.OrderByDescending(p => p.PayrollMonth).ToListAsync(ct)).Select(ToDto).ToList();
    }

    public async Task<PayslipDto?> LatestAsync(string employeeId, CancellationToken ct)
    {
        var p = await db.Payslips.AsNoTracking().Where(x => x.EmployeeId == employeeId).OrderByDescending(x => x.PayrollMonth).FirstOrDefaultAsync(ct);
        return p is null ? null : ToDto(p);
    }

    public async Task<(Stream Stream, string FileName, long Size)> OpenAsync(string payslipId, CancellationToken ct)
    {
        var p = await db.Payslips.AsNoTracking().FirstOrDefaultAsync(x => x.Id == payslipId, ct) ?? throw new NotFoundException("Payslip not found");
        if (p.EmployeeId != user.EmployeeId && !user.HasPermission(Perm.PayslipViewAll) && !user.IsSuperAdmin) throw new ForbiddenException("You may only download your own payslips");
        await audit.WriteAsync("Payslip", payslipId, "DOWNLOADED");
        return (storage.Open(p.StoragePath), p.FileName, p.SizeBytes);
    }
}

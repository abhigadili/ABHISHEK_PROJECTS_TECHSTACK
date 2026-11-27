using HR.Common.Common;
using HR.Common.Data;
using HR.PayrollService.Data;
using HR.PayrollService.DTOs;
using HR.PayrollService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.PayrollService.Services;

public interface IAdjustmentService
{
    Task<AdjustmentDto> CreateAsync(AdjustmentRequest r, CancellationToken ct);
    Task<List<AdjustmentDto>> ListAsync(string? employeeId, string? month, CancellationToken ct);
    Task<AdjustmentDto> CancelAsync(string id, CancellationToken ct);
    Task<SettlementBasisDto?> SettlementBasisAsync(string employeeId, CancellationToken ct);
    Task<AdjustmentDto> PostSettlementAsync(SettlementPostRequest r, CancellationToken ct);
    Task<LoanDto> CreateLoanAsync(LoanRequest r, CancellationToken ct);
    Task<List<LoanDto>> ListLoansAsync(string? employeeId, CancellationToken ct);
    Task<LoanDto> CloseLoanAsync(string id, CancellationToken ct);
}

public sealed class AdjustmentService(PayrollDbContext db, IAuditWriter audit) : IAdjustmentService
{
    private static AdjustmentDto ToDto(PayrollAdjustment a) => new(a.Id, a.EmployeeId, a.Type, a.Amount, a.PayrollMonth, a.Description, a.ReferenceId, a.Status, a.AppliedRunId, a.CreatedAt);
    private static LoanDto ToDto(Loan l) => new(l.Id, l.EmployeeId, l.Principal, l.Outstanding, l.Emi, l.StartMonth, l.Description, l.Status, l.Version);

    public async Task<AdjustmentDto> CreateAsync(AdjustmentRequest r, CancellationToken ct)
    {
        var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(x => x.PayrollMonth == r.PayrollMonth, ct);
        if (run is not null && run.Status != "DRAFT") throw new BusinessRuleException($"Payroll for {r.PayrollMonth} is already {run.Status}; use the next month");
        if (r.ReferenceId is not null && r.Type == "FINAL_SETTLEMENT" && await db.PayrollAdjustments.AnyAsync(a => a.ReferenceId == r.ReferenceId && a.Type == "FINAL_SETTLEMENT" && (a.Status == "PENDING" || a.Status == "APPLIED"), ct))
            throw new ConflictException("A settlement adjustment for this reference already exists");
        var a = new PayrollAdjustment { EmployeeId = r.EmployeeId, Type = r.Type, Amount = r.Amount, PayrollMonth = r.PayrollMonth, Description = r.Description, ReferenceId = r.ReferenceId, Status = "PENDING" };
        db.PayrollAdjustments.Add(a);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("PayrollAdjustment", a.Id, "CREATED", null, new { r.Type, month = r.PayrollMonth });
        return ToDto(a);
    }

    public async Task<List<AdjustmentDto>> ListAsync(string? employeeId, string? month, CancellationToken ct)
    {
        var q = db.PayrollAdjustments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(employeeId)) q = q.Where(a => a.EmployeeId == employeeId);
        if (!string.IsNullOrEmpty(month)) q = q.Where(a => a.PayrollMonth == month);
        return (await q.OrderByDescending(a => a.CreatedAt).Take(500).ToListAsync(ct)).Select(ToDto).ToList();
    }

    public async Task<AdjustmentDto> CancelAsync(string id, CancellationToken ct)
    {
        var a = await db.PayrollAdjustments.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Adjustment not found");
        if (a.Status != "PENDING") throw new BusinessRuleException("Only pending adjustments can be cancelled");
        a.Status = "CANCELLED";
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("PayrollAdjustment", id, "CANCELLED");
        return ToDto(a);
    }

    /// <summary>Gross monthly salary used by the exit settlement (restricted endpoint).</summary>
    public async Task<SettlementBasisDto?> SettlementBasisAsync(string employeeId, CancellationToken ct)
    {
        var s = await db.EmployeeSalaries.AsNoTracking().Where(x => x.EmployeeId == employeeId && x.Status == "ACTIVE").OrderByDescending(x => x.EffectiveFrom).FirstOrDefaultAsync(ct);
        return s is null ? null : new SettlementBasisDto(Math.Round(s.AnnualCtc / 12, 2), s.Currency);
    }

    /// <summary>Posts a settlement into the payroll month (idempotent per referenceId): positive => earning, negative => recovery. Rolls forward to the first open month.</summary>
    public async Task<AdjustmentDto> PostSettlementAsync(SettlementPostRequest r, CancellationToken ct)
    {
        var existing = await db.PayrollAdjustments.AsNoTracking().FirstOrDefaultAsync(a => a.ReferenceId == r.ReferenceId && (a.Status == "PENDING" || a.Status == "APPLIED"), ct);
        if (existing is not null) return ToDto(existing);
        var type = r.Amount > 0 ? "FINAL_SETTLEMENT" : "OTHER_DEDUCTION";
        var cursor = DateOnly.ParseExact(r.Month + "-01", "yyyy-MM-dd");
        for (var i = 0; i < 12; i++, cursor = cursor.AddMonths(1))
        {
            var month = cursor.ToString("yyyy-MM");
            var run = await db.PayrollRuns.AsNoTracking().FirstOrDefaultAsync(x => x.PayrollMonth == month, ct);
            if (run is null || run.Status == "DRAFT")
                return await CreateAsync(new AdjustmentRequest { EmployeeId = r.EmployeeId, Type = type, Amount = Math.Abs(r.Amount), PayrollMonth = month, Description = r.Description, ReferenceId = r.ReferenceId }, ct);
        }
        throw new BusinessRuleException("No open payroll month is available for the settlement");
    }

    public async Task<LoanDto> CreateLoanAsync(LoanRequest r, CancellationToken ct)
    {
        var l = new Loan { EmployeeId = r.EmployeeId, Principal = r.Principal, Outstanding = r.Principal, Emi = r.Emi, StartMonth = r.StartMonth, Description = r.Description, Status = "ACTIVE" };
        db.Loans.Add(l);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Loan", l.Id, "CREATED", null, new { r.EmployeeId });
        return ToDto(l);
    }

    public async Task<List<LoanDto>> ListLoansAsync(string? employeeId, CancellationToken ct) =>
        (await db.Loans.AsNoTracking().Where(l => employeeId == null || l.EmployeeId == employeeId).OrderByDescending(l => l.CreatedAt).Take(500).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<LoanDto> CloseLoanAsync(string id, CancellationToken ct)
    {
        var l = await db.Loans.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Loan not found");
        if (l.Status == "CLOSED") return ToDto(l);
        l.Status = "CLOSED"; l.Outstanding = 0;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Loan", id, "CLOSED_EARLY");
        return ToDto(l);
    }
}

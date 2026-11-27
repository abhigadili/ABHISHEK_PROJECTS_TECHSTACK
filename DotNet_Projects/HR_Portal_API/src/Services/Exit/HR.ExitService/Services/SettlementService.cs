using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.ExitService.Clients;
using HR.ExitService.Data;
using HR.ExitService.DTOs;
using HR.ExitService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.ExitService.Services;

public interface ISettlementService
{
    Task<SettlementDto?> CalculateAsync(string resignationId, CancellationToken ct);
    Task<SettlementDto?> AddLineAsync(string resignationId, SettlementLineRequest r, CancellationToken ct);
    Task<SettlementDto?> ViewAsync(string resignationId, CancellationToken ct);
    Task<ResignationDetailDto> ProcessAsync(string resignationId, string? paymentReference, CancellationToken ct);
}

/// <summary>Full &amp; final settlement: pro-rata salary + notice shortfall recovery + manual lines; totals recomputed by the existing stored procedure; payroll posts and pays it.</summary>
public sealed class SettlementService(ExitDbContext db, IResignationService core, IPayrollClient payroll, IAdoNet ado, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow) : ISettlementService
{
    private static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    public async Task<SettlementDto?> CalculateAsync(string resignationId, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        if (r.Status is not ("INTERVIEW_DONE" or "SETTLEMENT_PENDING")) throw new BusinessRuleException("Settlement can be calculated after the exit interview");
        var existing = await db.Settlements.FirstOrDefaultAsync(s => s.ResignationId == resignationId, ct);
        if (existing?.Status == "PAID") throw new ConflictException("Settlement is already paid");
        var policy = await db.ExitPolicies.AsNoTracking().OrderByDescending(p => p.CreatedAt).FirstOrDefaultAsync(ct) ?? new ExitPolicy { SalaryDaysPerMonth = 30 };
        var basis = await payroll.BasisAsync(r.EmployeeId, ct) ?? throw new BusinessRuleException("Could not determine the salary basis from payroll (no active salary?)");
        var daily = basis.MonthlyGross / policy.SalaryDaysPerMonth;
        var lwd = r.ConfirmedLastWorkingDay ?? throw new BusinessRuleException("The last working day has not been confirmed");
        var daysWorked = Math.Min(lwd.Day, policy.SalaryDaysPerMonth);
        var shortfall = Math.Max(0, r.NoticePeriodDays - (lwd.DayNumber - r.SubmittedOn.DayNumber) - r.WaiverDays);
        var auto = new List<(string Type, string Code, string Desc, decimal Amount)> { ("EARNING", "SALARY_PRORATA", $"Salary for {daysWorked} day(s) of {lwd:yyyy-MM}", R(daily * daysWorked)) };
        if (shortfall > 0) auto.Add(("DEDUCTION", "NOTICE_SHORTFALL", $"Notice shortfall recovery ({shortfall} day(s))", R(daily * shortfall)));
        await uow.ExecuteAsync(async () =>
        {
            var s = existing;
            if (s is null) { s = new Settlement { ResignationId = resignationId, EmployeeId = r.EmployeeId, Status = "CALCULATED", CalculatedBy = user.UserId }; db.Settlements.Add(s); await db.SaveChangesAsync(ct); }
            db.SettlementLines.RemoveRange(await db.SettlementLines.Where(l => l.SettlementId == s.Id && (l.Code == "SALARY_PRORATA" || l.Code == "NOTICE_SHORTFALL")).ToListAsync(ct));
            foreach (var l in auto) db.SettlementLines.Add(new SettlementLine { SettlementId = s.Id, Type = l.Type, Code = l.Code, Description = l.Desc, Amount = l.Amount });
            if (r.Status == "INTERVIEW_DONE") core.Transition(r, "SETTLEMENT_PENDING", "Settlement calculated");
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Settlement", s.Id, "CALCULATED");
        }, ct);
        return await ViewAsync(resignationId, ct);
    }

    /// <summary>HR adds manual lines (leave encashment, asset recovery, reimbursements ...).</summary>
    public async Task<SettlementDto?> AddLineAsync(string resignationId, SettlementLineRequest req, CancellationToken ct)
    {
        var s = await db.Settlements.AsNoTracking().FirstOrDefaultAsync(x => x.ResignationId == resignationId, ct) ?? throw new BusinessRuleException("Calculate the settlement first");
        if (s.Status == "PAID") throw new BusinessRuleException("Settlement is already paid");
        db.SettlementLines.Add(new SettlementLine { SettlementId = s.Id, Type = req.Type, Code = req.Code, Description = req.Description, Amount = req.Amount });
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("Settlement", s.Id, "LINE_ADDED", null, req);
        return await ViewAsync(resignationId, ct);
    }

    private Task<List<Dictionary<string, object?>>> SummaryAsync(string resignationId, CancellationToken ct) =>
        ado.CallProcedureAsync("sp_exit_settlement_summary", r => r.ToDictionary(), new { p_resignation_id = resignationId }, ct);

    public async Task<SettlementDto?> ViewAsync(string resignationId, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        if (!user.HasAnyPermission(Perm.ExitManage, Perm.PayrollProcess, Perm.PayrollView) && r.EmployeeId != user.EmployeeId && !user.IsSuperAdmin) throw new ForbiddenException();
        var exists = await db.Settlements.AsNoTracking().AnyAsync(x => x.ResignationId == resignationId, ct);
        if (!exists) return null;
        var summary = (await SummaryAsync(resignationId, ct)).FirstOrDefault();   // recomputes totals through the stored procedure
        var s = await db.Settlements.AsNoTracking().FirstAsync(x => x.ResignationId == resignationId, ct);
        var lines = await db.SettlementLines.AsNoTracking().Where(l => l.SettlementId == s.Id).OrderByDescending(l => l.Type).ThenBy(l => l.CreatedAt).Select(l => new SettlementLineDto(l.Id, l.Type, l.Code, l.Description, l.Amount)).ToListAsync(ct);
        return new SettlementDto(s.Id, s.ResignationId, s.EmployeeId, s.Status, s.GrossPayable, s.Recoveries, s.NetPayable, s.PaidAt, s.PaymentReference,
            summary?.GetValueOrDefault("tenureMonths"), summary?.GetValueOrDefault("noticeShortfallDays"), lines);
    }

    /// <summary>Payroll processes the final settlement: posts it to payroll as an adjustment, marks it paid, completes the exit and announces employee.exited.</summary>
    public async Task<ResignationDetailDto> ProcessAsync(string resignationId, string? paymentReference, CancellationToken ct)
    {
        var r = await core.LoadAsync(resignationId, ct);
        if (r.Status != "SETTLEMENT_PENDING") throw new BusinessRuleException("Resignation is not awaiting settlement");
        await SummaryAsync(resignationId, ct);
        var s = await db.Settlements.FirstOrDefaultAsync(x => x.ResignationId == resignationId, ct);
        if (s is null || s.Status != "CALCULATED") throw new BusinessRuleException("Settlement has not been calculated");
        await db.Entry(s).ReloadAsync(ct);
        var net = s.NetPayable;
        // external effect first (idempotent per referenceId on the payroll side); then the local transaction
        if (net != 0) await payroll.PostSettlementAsync(r.EmployeeId, net, r.ConfirmedLastWorkingDay!.Value.ToString("yyyy-MM"), s.Id, $"Full & final settlement ({r.EmployeeName})", ct);
        await uow.ExecuteAsync(async () =>
        {
            s.Status = "PAID"; s.PaidAt = DateTime.UtcNow; s.ProcessedBy = user.UserId; s.PaymentReference = paymentReference;
            r.CompletedAt = DateTime.UtcNow;
            core.Transition(r, "COMPLETED", "Final settlement processed");
            events.Publish(Topics.EmployeeExited, r.EmployeeId, new EmployeeExitedEvent(r.EmployeeId, resignationId, r.ConfirmedLastWorkingDay!.Value, "RESIGNED"));
            events.Publish(Topics.NotificationRequested, r.EmployeeId, new NotificationRequestedEvent(r.EmployeeId, null, "EXIT_COMPLETED", "IN_APP", "Exit completed",
                "Your final settlement has been processed. Thank you for your contributions.", null, "Resignation", resignationId, null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Settlement", s.Id, "PAID", null, new { net });
        }, ct);
        return await core.GetAsync(resignationId, ct);
    }
}

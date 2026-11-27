using HR.AttendanceService.Data;
using HR.AttendanceService.DTOs;
using HR.AttendanceService.Entities;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.AttendanceService.Services;

public interface ICorrectionService
{
    Task<CorrectionDto> RequestAsync(CorrectionRequestDto r, CancellationToken ct);
    Task<PagedResult<CorrectionDto>> ListAsync(RequestListQuery q, CancellationToken ct);
    Task<CorrectionDto> DecideAsync(string id, bool approve, string? comment, CancellationToken ct);
    Task<CorrectionDto> CancelAsync(string id, CancellationToken ct);
}

public interface IWfhService
{
    Task<WfhDto> RequestAsync(WfhRequestDto r, CancellationToken ct);
    Task<PagedResult<WfhDto>> ListAsync(RequestListQuery q, CancellationToken ct);
    Task<WfhDto> DecideAsync(string id, bool approve, string? comment, CancellationToken ct);
    Task<WfhDto> CancelAsync(string id, CancellationToken ct);
}

/// <summary>Attendance regularization: the employee requests a punch correction, the manager (or HR) approves/rejects; approval rewrites the day through the attendance rules.</summary>
public sealed class CorrectionService(AttendanceDbContext db, IAttendanceService attendance, ICurrentUser user, OfficeTime office, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg) : ICorrectionService
{
    private int WindowDays => cfg.GetValue("Attendance:CorrectionWindowDays", 31);
    private static CorrectionDto ToDto(AttendanceCorrection c) => c.Adapt<CorrectionDto>();
    private bool CanDecide(string employeeId, string? managerId) => employeeId != user.EmployeeId && (managerId == user.EmployeeId || user.HasPermission(Perm.AttendanceManage) || user.IsSuperAdmin);

    public async Task<CorrectionDto> RequestAsync(CorrectionRequestDto r, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        var date = r.WorkDate!.Value;
        if (date > office.Today) throw new Common.Common.ValidationException("Cannot correct a future date");
        if (date < office.Today.AddDays(-WindowDays)) throw new BusinessRuleException($"Corrections are only allowed for the last {WindowDays} days");
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == me, ct) ?? throw new NotFoundException("Employee not found");
        if (await db.AttendanceCorrections.AnyAsync(c => c.EmployeeId == me && c.WorkDate == date && c.Status == "PENDING", ct)) throw new ConflictException("A correction request for this date is already pending");
        var c = new AttendanceCorrection
        {
            EmployeeId = me, EmployeeName = emp.FullName, ManagerId = emp.ManagerId, WorkDate = date, RequestedCheckIn = r.RequestedCheckIn!.Value.ToUniversalTime(),
            RequestedCheckOut = r.RequestedCheckOut!.Value.ToUniversalTime(), Reason = r.Reason, Status = "PENDING", Escalated = emp.ManagerId is null
        };
        await uow.ExecuteAsync(async () => { db.AttendanceCorrections.Add(c); await db.SaveChangesAsync(ct); await audit.WriteAsync("AttendanceCorrection", c.Id, "REQUESTED", null, new { workDate = date }); }, ct);
        return ToDto(c);
    }

    public async Task<PagedResult<CorrectionDto>> ListAsync(RequestListQuery q, CancellationToken ct)
    {
        var me = user.EmployeeId ?? "-";
        var query = db.AttendanceCorrections.AsNoTracking().AsQueryable();
        if (user.HasPermission(Perm.AttendanceManage) || user.IsSuperAdmin) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(c => c.EmployeeId == q.EmployeeId); }
        else if (user.HasPermission(Perm.AttendanceApprove) && string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(c => c.ManagerId == me);
        else query = query.Where(c => c.EmployeeId == me);
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(c => c.Status == q.Status);
        query = query.OrderByAllowed(q.Sort ?? "CreatedAt", q.Sort is null || q.Descending, ["CreatedAt", "WorkDate", "Status"], "CreatedAt");
        return await query.ToPagedAsync(q, c => new CorrectionDto(c.Id, c.EmployeeId, c.EmployeeName, c.ManagerId, c.WorkDate, c.RequestedCheckIn, c.RequestedCheckOut, c.Reason, c.Status, c.Escalated, c.ReviewComment, c.ReviewedAt, c.CreatedAt), ct);
    }

    public async Task<CorrectionDto> DecideAsync(string id, bool approve, string? comment, CancellationToken ct)
    {
        var req = await db.AttendanceCorrections.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Correction request not found");
        if (req.Status != "PENDING") throw new BusinessRuleException($"Request is already {req.Status}");
        if (!CanDecide(req.EmployeeId, req.ManagerId)) throw new ForbiddenException("You are not the approver of this request");
        await uow.ExecuteAsync(async () =>
        {
            req.Status = approve ? "APPROVED" : "REJECTED"; req.ReviewerId = user.UserId; req.ReviewedAt = DateTime.UtcNow; req.ReviewComment = comment;
            if (approve) await attendance.ApplyCorrectionAsync(req.EmployeeId, req.WorkDate, req.RequestedCheckIn, req.RequestedCheckOut, ct);
            events.Publish(Topics.AttendanceCorrected, req.EmployeeId, new AttendanceEvent(req.EmployeeId, req.WorkDate, req.RequestedCheckIn, req.RequestedCheckOut, approve ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED", 0, 0, 0, 0, req.Id));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("AttendanceCorrection", id, approve ? "APPROVED" : "REJECTED", null, new { comment });
        }, ct);
        await attendance.EvictSummaryAsync(req.EmployeeId);
        return ToDto(req);
    }

    public async Task<CorrectionDto> CancelAsync(string id, CancellationToken ct)
    {
        var req = await db.AttendanceCorrections.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Correction request not found");
        if (req.EmployeeId != user.EmployeeId) throw new ForbiddenException();
        if (req.Status != "PENDING") throw new BusinessRuleException("Only pending requests can be cancelled");
        req.Status = "CANCELLED";
        await db.SaveChangesAsync(ct);
        return ToDto(req);
    }
}

public sealed class WfhService(AttendanceDbContext db, ICurrentUser user, OfficeTime office, IAuditWriter audit) : IWfhService
{
    private static WfhDto ToDto(WfhRequest w) => w.Adapt<WfhDto>();

    public async Task<WfhDto> RequestAsync(WfhRequestDto r, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == me, ct) ?? throw new NotFoundException("Employee not found");
        var from = r.FromDate!.Value; var to = r.ToDate!.Value;
        if (await db.WfhRequests.AnyAsync(w => w.EmployeeId == me && (w.Status == "PENDING" || w.Status == "APPROVED") && w.FromDate <= to && w.ToDate >= from, ct))
            throw new ConflictException("A work-from-home request already covers part of this range");
        var w = new WfhRequest { EmployeeId = me, EmployeeName = emp.FullName, ManagerId = emp.ManagerId, FromDate = from, ToDate = to, Reason = r.Reason, Status = "PENDING" };
        db.WfhRequests.Add(w);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("WfhRequest", w.Id, "REQUESTED", null, r);
        return ToDto(w);
    }

    public async Task<PagedResult<WfhDto>> ListAsync(RequestListQuery q, CancellationToken ct)
    {
        var me = user.EmployeeId ?? "-";
        var query = db.WfhRequests.AsNoTracking().AsQueryable();
        if (user.HasPermission(Perm.AttendanceManage) || user.IsSuperAdmin) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(c => c.EmployeeId == q.EmployeeId); }
        else if (user.HasPermission(Perm.AttendanceApprove) && string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(c => c.ManagerId == me);
        else query = query.Where(c => c.EmployeeId == me);
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(c => c.Status == q.Status);
        query = query.OrderByAllowed(q.Sort ?? "CreatedAt", q.Sort is null || q.Descending, ["CreatedAt", "FromDate", "Status"], "CreatedAt");
        return await query.ToPagedAsync(q, c => new WfhDto(c.Id, c.EmployeeId, c.EmployeeName, c.ManagerId, c.FromDate, c.ToDate, c.Reason, c.Status, c.ReviewComment, c.ReviewedAt, c.CreatedAt), ct);
    }

    public async Task<WfhDto> DecideAsync(string id, bool approve, string? comment, CancellationToken ct)
    {
        var req = await db.WfhRequests.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("WFH request not found");
        if (req.Status != "PENDING") throw new BusinessRuleException($"Request is already {req.Status}");
        if (req.EmployeeId == user.EmployeeId || !(req.ManagerId == user.EmployeeId || user.HasPermission(Perm.AttendanceManage) || user.IsSuperAdmin)) throw new ForbiddenException("You are not the approver of this request");
        req.Status = approve ? "APPROVED" : "REJECTED"; req.ReviewerId = user.UserId; req.ReviewedAt = DateTime.UtcNow; req.ReviewComment = comment;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("WfhRequest", id, approve ? "APPROVED" : "REJECTED", null, new { comment });
        return ToDto(req);
    }

    public async Task<WfhDto> CancelAsync(string id, CancellationToken ct)
    {
        var req = await db.WfhRequests.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("WFH request not found");
        if (req.EmployeeId != user.EmployeeId) throw new ForbiddenException();
        if (req.Status is not ("PENDING" or "APPROVED") || req.ToDate < office.Today) throw new BusinessRuleException("This request can no longer be cancelled");
        req.Status = "CANCELLED";
        await db.SaveChangesAsync(ct);
        return ToDto(req);
    }
}

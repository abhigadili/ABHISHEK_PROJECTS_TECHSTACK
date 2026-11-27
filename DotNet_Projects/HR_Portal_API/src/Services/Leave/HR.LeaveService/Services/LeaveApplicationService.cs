using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.LeaveService.Clients;
using HR.LeaveService.Data;
using HR.LeaveService.DTOs;
using HR.LeaveService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.LeaveService.Services;

public interface ILeaveApplicationService
{
    Task<LeaveDetailDto> ApplyAsync(ApplyLeaveRequest r, CancellationToken ct);
    Task<LeaveDetailDto> UpdateAsync(string id, UpdateLeaveRequest r, CancellationToken ct);
    Task<LeaveDetailDto> ApproveAsync(string id, string? comment, CancellationToken ct);
    Task<LeaveDetailDto> RejectAsync(string id, string comment, CancellationToken ct);
    Task<LeaveDetailDto> WithdrawAsync(string id, CancellationToken ct);
    Task<LeaveDetailDto> RequestCancellationAsync(string id, string reason, CancellationToken ct);
    Task<LeaveDetailDto> DecideCancellationAsync(string id, bool approve, string? comment, CancellationToken ct);
    Task<LeaveDetailDto> GetAsync(string id, CancellationToken ct);
    Task<PagedResult<LeaveApplicationDto>> ListAsync(LeaveListQuery q, CancellationToken ct);
    Task<List<LeaveApplicationDto>> PendingApprovalsAsync(CancellationToken ct);
    Task<CommentDto> AddCommentAsync(string id, string comment, CancellationToken ct);
    Task<AttachmentDto> AddAttachmentAsync(string id, AttachmentRef a, CancellationToken ct);
    Task<List<CalendarEntryDto>> CalendarAsync(DateOnly from, DateOnly to, string? employeeId, CancellationToken ct);
    Task<List<CalendarEntryDto>> TeamCalendarAsync(DateOnly from, DateOnly to, CancellationToken ct);
    Task<List<CalendarEntryDto>> UpcomingAsync(int days, CancellationToken ct);
    Task<LeaveMonthlySummaryDto> MonthlySummaryAsync(string employeeId, string month, CancellationToken ct);
    Task<LeaveOverviewDto> OverviewAsync(string employeeId, int year, CancellationToken ct);
}

public sealed class LeaveApplicationService(LeaveDbContext db, IBalanceService balances, IHolidayClient holidays, IEmployeeClient employees, ICurrentUser user, IAdoNet ado, IEventPublisher events,
    IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg) : ILeaveApplicationService
{
    private int BackdateDays => cfg.GetValue("Leave:BackdateDays", 7);
    private bool IsHr => user.HasPermission(Perm.LeavePolicyManage) || user.IsSuperAdmin;

    // ------------------------------------------------------------------ helpers
    private async Task<LeaveEmployee> EmployeeAsync(string id, CancellationToken ct)
    {
        var local = await db.LeaveEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == id, ct);
        if (local is not null) return local;
        // read model not populated yet -> ask the Employee Service (synchronous) and remember the answer
        var e = await employees.SummaryAsync(id, ct) ?? throw new NotFoundException("Employee not found");
        var row = new LeaveEmployee { EmployeeId = e.EmployeeId, FullName = e.FullName, ManagerId = e.ManagerId, DepartmentId = e.DepartmentId, LocationId = e.LocationId, Status = e.Status, Gender = e.Gender, JoiningDate = e.JoiningDate };
        db.LeaveEmployees.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    /// <summary>Working-day duration from the database function fn_leave_duration(from, to, halfStart, halfEnd, holidays).</summary>
    private async Task<decimal> DurationAsync(LeaveEmployee emp, DateOnly from, DateOnly to, bool hs, bool he, CancellationToken ct)
    {
        var hol = await holidays.WeekdayHolidaysAsync(from, to, emp.LocationId, emp.DepartmentId, ct);
        return await ado.ScalarAsync<decimal?>("SELECT fn_leave_duration(@f, @t, @hs, @he, @h)",
            new { f = from.ToDateTime(TimeOnly.MinValue), t = to.ToDateTime(TimeOnly.MinValue), hs = hs ? 1 : 0, he = he ? 1 : 0, h = hol }, ct) ?? 0;
    }

    private bool CanActOnStage(LeaveApplication app)
    {
        if (app.EmployeeId == user.EmployeeId) return false;   // never approve your own leave
        return app.Stage switch
        {
            "MANAGER" => user.EmployeeId == app.ManagerId || user.HasPermission(Perm.LeavePolicyManage) || user.IsSuperAdmin,
            "HR" => user.HasPermission(Perm.LeavePolicyManage) || user.IsSuperAdmin,
            _ => false
        };
    }

    private bool CanView(LeaveApplication app) => app.EmployeeId == user.EmployeeId || app.ManagerId == user.EmployeeId || IsHr;

    private LeaveEvent Event(LeaveApplication app, string typeCode, string? comment = null) =>
        new(app.Id, app.EmployeeId, app.EmployeeName ?? "", app.ManagerId, typeCode, app.FromDate, app.ToDate, app.Days, app.Status, app.Reason, user.UserId, comment);

    private void Record(LeaveApplication app, string action, string stage, string? comment) =>
        db.LeaveApprovals.Add(new LeaveApproval { ApplicationId = app.Id, Action = action, Stage = stage, ActorId = user.UserId, Comment = comment });

    private async Task<LeaveType> TypeAsync(string id, CancellationToken ct) => await db.LeaveTypes.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Leave type not found");

    private async Task<bool> HrNeededAsync(LeaveType type, decimal days, CancellationToken ct)
    {
        var policy = await db.LeavePolicies.AsNoTracking().Where(p => p.Active).OrderByDescending(p => p.IsDefault).FirstOrDefaultAsync(ct);
        return type.RequiresHrApproval || (policy is not null && days > policy.HrApprovalThresholdDays);
    }

    private async Task AssertNoOverlapAsync(string employeeId, DateOnly from, DateOnly to, string? excludeId, CancellationToken ct)
    {
        var ex = excludeId ?? "";
        // locking read inside the transaction: two concurrent applications for the same dates serialise here
        var clash = await db.LeaveApplications.FromSqlInterpolated(
            $"SELECT * FROM leave_applications WHERE employee_id = {employeeId} AND status IN ('PENDING','APPROVED') AND from_date <= {to} AND to_date >= {from} AND id <> {ex} FOR UPDATE").AsNoTracking().ToListAsync(ct);
        if (clash.Count > 0) throw new ConflictException("You already have a pending or approved leave overlapping these dates");
    }

    private async Task MoveBalanceAsync(LeaveApplication app, LeaveType type, decimal pendingDelta, decimal usedDelta, CancellationToken ct)
    {
        if (!type.BalanceTracked) return;
        var (row, _) = await balances.LockAvailableAsync(app.EmployeeId, type.Id, app.FromDate.Year, ct);
        if (row is null) return;
        row.Pending += pendingDelta; row.Used += usedDelta;
    }

    // ------------------------------------------------------------------ apply
    public async Task<LeaveDetailDto> ApplyAsync(ApplyLeaveRequest r, CancellationToken ct)
    {
        var employeeId = r.EmployeeId is not null && IsHr ? r.EmployeeId : user.EmployeeId;
        if (employeeId is null) throw new ForbiddenException("Your account is not linked to an employee");
        if (r.EmployeeId is not null && r.EmployeeId != employeeId) throw new ForbiddenException("Only HR can apply on behalf of others");
        var emp = await EmployeeAsync(employeeId, ct);
        if (emp.Status is not ("ACTIVE" or "ON_NOTICE")) throw new BusinessRuleException("Only active employees can apply for leave");
        var type = await TypeAsync(r.LeaveTypeId, ct);
        if (!type.Active) throw new BusinessRuleException("This leave type is not active");
        if (type.GenderRestriction is not null && emp.Gender is not null && type.GenderRestriction != emp.Gender) throw new BusinessRuleException($"{type.Name} is not available to this employee");
        if ((r.HalfDayStart || r.HalfDayEnd) && !type.HalfDayAllowed) throw new BusinessRuleException($"{type.Name} does not allow half days");
        var from = r.FromDate!.Value; var to = r.ToDate!.Value;
        if (from < DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-BackdateDays)) throw new BusinessRuleException($"Leave cannot be back-dated by more than {BackdateDays} days");
        var days = await DurationAsync(emp, from, to, r.HalfDayStart, r.HalfDayEnd, ct);
        if (days <= 0) throw new BusinessRuleException("The selected dates contain no working days");
        if (type.AttachmentRequiredFromDays is { } n && days >= n && r.Attachments.Count == 0) throw new Common.Common.ValidationException($"{type.Name} of {n}+ days requires a supporting attachment");
        var hrNeeded = await HrNeededAsync(type, days, ct);

        var app = new LeaveApplication
        {
            EmployeeId = employeeId, EmployeeName = emp.FullName, LeaveTypeId = type.Id, FromDate = from, ToDate = to, Days = days, HalfDayStart = r.HalfDayStart, HalfDayEnd = r.HalfDayEnd,
            Reason = r.Reason, Status = "PENDING", Stage = emp.ManagerId is null ? "HR" : "MANAGER", ManagerId = emp.ManagerId, AppliedAt = DateTime.UtcNow
        };
        await uow.ExecuteAsync(async () =>
        {
            await AssertNoOverlapAsync(employeeId, from, to, null, ct);
            if (type.BalanceTracked)
            {
                var (row, available) = await balances.LockAvailableAsync(employeeId, type.Id, from.Year, ct);
                if (row is null) throw new BusinessRuleException($"No {type.Name} balance exists for {from.Year}");
                if (days > available) throw new BusinessRuleException($"Insufficient {type.Name} balance: requested {days}, available {available}");
                row.Pending += days;
            }
            db.LeaveApplications.Add(app);
            foreach (var a in r.Attachments) db.LeaveAttachments.Add(new LeaveAttachment { ApplicationId = app.Id, DocumentId = a.DocumentId, FileName = a.FileName });
            Record(app, "SUBMITTED", app.Stage, r.Reason);
            events.Publish(Topics.LeaveApplied, employeeId, Event(app, type.Code));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveApplication", app.Id, "SUBMITTED", null, new { type.Code, from, to, days, hrNeeded });
        }, ct);
        await balances.EvictAsync(employeeId);
        return await GetAsync(app.Id, ct);
    }

    // ------------------------------------------------------------------ update (only while pending)
    public async Task<LeaveDetailDto> UpdateAsync(string id, UpdateLeaveRequest r, CancellationToken ct)
    {
        var app = await db.LeaveApplications.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (app.EmployeeId != user.EmployeeId) throw new ForbiddenException("Only the applicant can edit this application");
        if (app.Status != "PENDING" || app.Stage == "COMPLETE") throw new BusinessRuleException("Only pending applications can be edited");
        var emp = await EmployeeAsync(app.EmployeeId, ct);
        var from = r.FromDate ?? app.FromDate; var to = r.ToDate ?? app.ToDate;
        if (to < from) throw new Common.Common.ValidationException("toDate must not precede fromDate");
        if (from.Year != to.Year) throw new Common.Common.ValidationException("A leave request cannot span two calendar years");
        var oldType = await TypeAsync(app.LeaveTypeId, ct);
        var type = await TypeAsync(r.LeaveTypeId ?? app.LeaveTypeId, ct);
        var hs = r.HalfDayStart ?? app.HalfDayStart; var he = r.HalfDayEnd ?? app.HalfDayEnd;
        if ((hs || he) && !type.HalfDayAllowed) throw new BusinessRuleException($"{type.Name} does not allow half days");
        var days = await DurationAsync(emp, from, to, hs, he, ct);
        if (days <= 0) throw new BusinessRuleException("The selected dates contain no working days");
        var oldFromYear = app.FromDate.Year; var oldDays = app.Days;
        await uow.ExecuteAsync(async () =>
        {
            await AssertNoOverlapAsync(app.EmployeeId, from, to, id, ct);
            if (oldType.BalanceTracked)
            {
                var (old, _) = await balances.LockAvailableAsync(app.EmployeeId, oldType.Id, oldFromYear, ct);
                if (old is not null) old.Pending -= oldDays;
            }
            if (type.BalanceTracked)
            {
                var (row, _) = await balances.LockAvailableAsync(app.EmployeeId, type.Id, from.Year, ct);
                if (row is null) throw new BusinessRuleException($"No {type.Name} balance exists for {from.Year}");
                if (days > Math.Round(row.Opening + row.Accrued + row.CarriedForward + row.Adjusted - row.Used - row.Pending - row.Encashed, 2))
                    throw new BusinessRuleException($"Insufficient {type.Name} balance for the updated request");
                row.Pending += days;
            }
            app.LeaveTypeId = type.Id; app.FromDate = from; app.ToDate = to; app.Days = days; app.HalfDayStart = hs; app.HalfDayEnd = he; app.Reason = r.Reason ?? app.Reason;
            Record(app, "UPDATED", app.Stage, null);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveApplication", id, "UPDATED", null, new { from, to, days });
        }, ct);
        await balances.EvictAsync(app.EmployeeId);
        return await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ approval workflow (State pattern: PENDING/MANAGER -> PENDING/HR -> APPROVED/COMPLETE)
    public async Task<LeaveDetailDto> ApproveAsync(string id, string? comment, CancellationToken ct)
    {
        var app = await db.LeaveApplications.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (app.Status != "PENDING") throw new BusinessRuleException($"Application is already {app.Status}");
        if (app.CancelRequested) throw new BusinessRuleException("Use the cancellation decision endpoints for this application");
        if (!CanActOnStage(app)) throw new ForbiddenException("You are not the approver for this stage");
        var type = await TypeAsync(app.LeaveTypeId, ct);
        var needsHr = app.Stage == "MANAGER" && await HrNeededAsync(type, app.Days, ct);
        var wasStage = app.Stage;
        await uow.ExecuteAsync(async () =>
        {
            if (needsHr)
            {
                app.Stage = "HR";
                Record(app, "MANAGER_APPROVED", "MANAGER", comment);
            }
            else
            {
                app.Status = "APPROVED"; app.Stage = "COMPLETE"; app.DecidedAt = DateTime.UtcNow;
                await MoveBalanceAsync(app, type, -app.Days, app.Days, ct);
                Record(app, wasStage == "HR" ? "HR_APPROVED" : "MANAGER_APPROVED", wasStage, comment);
                events.Publish(Topics.LeaveApproved, app.EmployeeId, Event(app, type.Code, comment));
            }
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveApplication", id, needsHr ? "MANAGER_APPROVED" : "APPROVED", null, new { comment });
        }, ct);
        await balances.EvictAsync(app.EmployeeId);
        return await GetAsync(id, ct);
    }

    public async Task<LeaveDetailDto> RejectAsync(string id, string comment, CancellationToken ct)
    {
        var app = await db.LeaveApplications.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (app.Status != "PENDING") throw new BusinessRuleException($"Application is already {app.Status}");
        if (!CanActOnStage(app)) throw new ForbiddenException("You are not the approver for this stage");
        var type = await TypeAsync(app.LeaveTypeId, ct);
        await uow.ExecuteAsync(async () =>
        {
            app.Status = "REJECTED"; app.Stage = "COMPLETE"; app.DecidedAt = DateTime.UtcNow;
            await MoveBalanceAsync(app, type, -app.Days, 0, ct);
            Record(app, "REJECTED", "MANAGER", comment);
            events.Publish(Topics.LeaveRejected, app.EmployeeId, Event(app, type.Code, comment));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveApplication", id, "REJECTED", null, new { comment });
        }, ct);
        await balances.EvictAsync(app.EmployeeId);
        return await GetAsync(id, ct);
    }

    /// <summary>The applicant withdraws a still-pending application (balance reservation released).</summary>
    public async Task<LeaveDetailDto> WithdrawAsync(string id, CancellationToken ct)
    {
        var app = await db.LeaveApplications.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (app.EmployeeId != user.EmployeeId) throw new ForbiddenException("Only the applicant can withdraw");
        if (app.Status != "PENDING") throw new BusinessRuleException("Only pending applications can be withdrawn; request cancellation for approved leave");
        var type = await TypeAsync(app.LeaveTypeId, ct);
        await uow.ExecuteAsync(async () =>
        {
            app.Status = "WITHDRAWN"; app.Stage = "COMPLETE"; app.DecidedAt = DateTime.UtcNow;
            await MoveBalanceAsync(app, type, -app.Days, 0, ct);
            Record(app, "WITHDRAWN", "COMPLETE", null);
            events.Publish(Topics.LeaveCancelled, app.EmployeeId, Event(app, type.Code, "withdrawn by employee"));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveApplication", id, "WITHDRAWN");
        }, ct);
        await balances.EvictAsync(app.EmployeeId);
        return await GetAsync(id, ct);
    }

    /// <summary>Cancelling APPROVED leave needs approval: the employee requests, manager/HR decides.</summary>
    public async Task<LeaveDetailDto> RequestCancellationAsync(string id, string reason, CancellationToken ct)
    {
        var app = await db.LeaveApplications.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (app.EmployeeId != user.EmployeeId) throw new ForbiddenException("Only the applicant can request cancellation");
        if (app.Status != "APPROVED") throw new BusinessRuleException("Only approved leave needs a cancellation request");
        if (app.CancelRequested) throw new ConflictException("A cancellation request is already pending");
        if (app.ToDate < DateOnly.FromDateTime(DateTime.UtcNow)) throw new BusinessRuleException("Leave that has already finished cannot be cancelled");
        app.CancelRequested = true; app.CancelReason = reason; app.Stage = app.ManagerId is null ? "HR" : "MANAGER";
        Record(app, "CANCEL_REQUESTED", app.Stage, reason);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("LeaveApplication", id, "CANCEL_REQUESTED", null, new { reason });
        return await GetAsync(id, ct);
    }

    public async Task<LeaveDetailDto> DecideCancellationAsync(string id, bool approve, string? comment, CancellationToken ct)
    {
        var app = await db.LeaveApplications.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (!app.CancelRequested || app.Status != "APPROVED") throw new BusinessRuleException("No cancellation request is pending");
        if (!CanActOnStage(app)) throw new ForbiddenException("You are not the approver for this stage");
        var type = await TypeAsync(app.LeaveTypeId, ct);
        await uow.ExecuteAsync(async () =>
        {
            if (!approve)
            {
                app.CancelRequested = false; app.CancelReason = null; app.Stage = "COMPLETE";
                Record(app, "CANCEL_REJECTED", app.Stage, comment);
            }
            else
            {
                var reason = app.CancelReason;
                app.Status = "CANCELLED"; app.Stage = "COMPLETE"; app.CancelRequested = false; app.DecidedAt = DateTime.UtcNow;
                await MoveBalanceAsync(app, type, 0, -app.Days, ct);
                Record(app, "CANCEL_APPROVED", "COMPLETE", comment);
                events.Publish(Topics.LeaveCancelled, app.EmployeeId, Event(app, type.Code, reason));
            }
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("LeaveApplication", id, approve ? "CANCEL_APPROVED" : "CANCEL_REJECTED", null, new { comment });
        }, ct);
        await balances.EvictAsync(app.EmployeeId);
        return await GetAsync(id, ct);
    }

    // ------------------------------------------------------------------ reads
    private static LeaveApplicationDto ToDto(LeaveApplication a) => a.Adapt<LeaveApplicationDto>();

    public async Task<LeaveDetailDto> GetAsync(string id, CancellationToken ct)
    {
        var app = await db.LeaveApplications.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (!CanView(app)) throw new ForbiddenException("You are not allowed to view this application");
        // eager loading: the three child collections are fetched with one query each (no N+1)
        var approvals = await db.LeaveApprovals.AsNoTracking().Where(x => x.ApplicationId == id).OrderBy(x => x.CreatedAt).Select(x => new ApprovalDto(x.Id, x.Action, x.Stage, x.ActorId, x.Comment, x.CreatedAt)).ToListAsync(ct);
        var comments = await db.LeaveComments.AsNoTracking().Where(x => x.ApplicationId == id).OrderBy(x => x.CreatedAt).Select(x => new CommentDto(x.Id, x.AuthorId, x.Comment, x.CreatedAt)).ToListAsync(ct);
        var attachments = await db.LeaveAttachments.AsNoTracking().Where(x => x.ApplicationId == id).Select(x => new AttachmentDto(x.Id, x.DocumentId, x.FileName)).ToListAsync(ct);
        var type = await db.LeaveTypes.IgnoreQueryFilters().AsNoTracking().Where(t => t.Id == app.LeaveTypeId).Select(t => new { t.Code, t.Name }).FirstOrDefaultAsync(ct);
        return new LeaveDetailDto(ToDto(app), type?.Code, type?.Name, approvals, comments, attachments);
    }

    /// <summary>Employees see their own; managers their team's; HR everyone's.</summary>
    public async Task<PagedResult<LeaveApplicationDto>> ListAsync(LeaveListQuery q, CancellationToken ct)
    {
        var query = db.LeaveApplications.AsNoTracking().AsQueryable();
        if (IsHr) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(a => a.EmployeeId == q.EmployeeId); }
        else if (!string.IsNullOrEmpty(q.EmployeeId) && q.EmployeeId != user.EmployeeId)
        {
            var mgr = await db.LeaveEmployees.AsNoTracking().Where(e => e.EmployeeId == q.EmployeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            if (mgr is null || mgr != user.EmployeeId) throw new ForbiddenException("You may only list your own or your reports' leave");
            query = query.Where(a => a.EmployeeId == q.EmployeeId);
        }
        else { var me = user.EmployeeId ?? "-"; query = query.Where(a => a.EmployeeId == me); }
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(a => a.Status == q.Status);
        if (!string.IsNullOrEmpty(q.Stage)) query = query.Where(a => a.Stage == q.Stage);
        if (!string.IsNullOrEmpty(q.LeaveTypeId)) query = query.Where(a => a.LeaveTypeId == q.LeaveTypeId);
        if (q.From is { } f) query = query.Where(a => a.FromDate >= f);
        if (q.To is { } t) query = query.Where(a => a.ToDate <= t);
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(a => EF.Functions.Like(a.EmployeeName!, like) || EF.Functions.Like(a.Reason!, like)); }
        query = query.OrderByAllowed(q.Sort ?? "AppliedAt", q.Sort is null || q.Descending, ["AppliedAt", "FromDate", "ToDate", "Status", "Days"], "AppliedAt");
        return await query.ToPagedAsync(q, a => new LeaveApplicationDto(a.Id, a.EmployeeId, a.EmployeeName, a.LeaveTypeId, a.FromDate, a.ToDate, a.Days, a.HalfDayStart, a.HalfDayEnd, a.Reason, a.Status, a.Stage,
            a.ManagerId, a.AppliedAt, a.DecidedAt, a.CancelRequested, a.CancelReason, a.Version), ct);
    }

    public async Task<List<LeaveApplicationDto>> PendingApprovalsAsync(CancellationToken ct)
    {
        var me = user.EmployeeId;
        var q = db.LeaveApplications.AsNoTracking().Where(a => a.Status == "PENDING" || (a.Status == "APPROVED" && a.CancelRequested));
        var hr = IsHr;
        var rows = await q.Where(a => (a.Stage == "MANAGER" && a.ManagerId == me) || (hr && a.Stage == "HR")).OrderBy(a => a.AppliedAt).ToListAsync(ct);
        return rows.Where(a => a.EmployeeId != me).Select(ToDto).ToList();
    }

    public async Task<CommentDto> AddCommentAsync(string id, string comment, CancellationToken ct)
    {
        var app = await db.LeaveApplications.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (!CanView(app)) throw new ForbiddenException();
        var c = new LeaveComment { ApplicationId = id, AuthorId = user.EmployeeId ?? user.UserId, Comment = comment };
        db.LeaveComments.Add(c);
        await db.SaveChangesAsync(ct);
        return new CommentDto(c.Id, c.AuthorId, c.Comment, c.CreatedAt);
    }

    public async Task<AttachmentDto> AddAttachmentAsync(string id, AttachmentRef a, CancellationToken ct)
    {
        var app = await db.LeaveApplications.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Leave application not found");
        if (app.EmployeeId != user.EmployeeId && !IsHr) throw new ForbiddenException();
        var att = new LeaveAttachment { ApplicationId = id, DocumentId = a.DocumentId, FileName = a.FileName };
        db.LeaveAttachments.Add(att);
        await db.SaveChangesAsync(ct);
        return new AttachmentDto(att.Id, att.DocumentId, att.FileName);
    }

    // ------------------------------------------------------------------ calendars
    private async Task<List<CalendarEntryDto>> CalendarQueryAsync(DateOnly rangeStart, DateOnly rangeEnd, List<string>? employeeIds, CancellationToken ct)
    {
        var q = from a in db.LeaveApplications.AsNoTracking()
                join t in db.LeaveTypes.IgnoreQueryFilters() on a.LeaveTypeId equals t.Id
                where (a.Status == "PENDING" || a.Status == "APPROVED") && a.FromDate <= rangeEnd && a.ToDate >= rangeStart && (employeeIds == null || employeeIds.Contains(a.EmployeeId))
                orderby a.FromDate
                select new CalendarEntryDto(a.Id, a.EmployeeId, a.EmployeeName, a.FromDate, a.ToDate, a.Days, a.Status, t.Code, t.Name);
        return await q.ToListAsync(ct);
    }

    public Task<List<CalendarEntryDto>> CalendarAsync(DateOnly from, DateOnly to, string? employeeId, CancellationToken ct)
    {
        var target = employeeId ?? user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        if (target != user.EmployeeId && !IsHr) throw new ForbiddenException();
        return CalendarQueryAsync(from, to, [target], ct);
    }

    public async Task<List<CalendarEntryDto>> TeamCalendarAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        List<string>? team = null;
        if (!IsHr) { var me = user.EmployeeId ?? "-"; team = await db.LeaveEmployees.AsNoTracking().Where(e => e.ManagerId == me).Select(e => e.EmployeeId).ToListAsync(ct); }
        return await CalendarQueryAsync(from, to, team, ct);
    }

    public Task<List<CalendarEntryDto>> UpcomingAsync(int days, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return TeamCalendarAsync(today, today.AddDays(days), ct);
    }

    /// <summary>Used by Payroll: approved leave days in a month, split into paid / unpaid (clipped to the month boundaries).</summary>
    public async Task<LeaveMonthlySummaryDto> MonthlySummaryAsync(string employeeId, string month, CancellationToken ct)
    {
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var first)) throw new Common.Common.ValidationException("month must be yyyy-MM");
        var last = first.AddMonths(1).AddDays(-1);
        var rows = await (from a in db.LeaveApplications.AsNoTracking()
                          join t in db.LeaveTypes.IgnoreQueryFilters() on a.LeaveTypeId equals t.Id
                          where a.EmployeeId == employeeId && a.Status == "APPROVED" && a.FromDate <= last && a.ToDate >= first
                          select new { t.Code, t.Paid, a.Days }).ToListAsync(ct);
        var byType = rows.GroupBy(r => new { r.Code, r.Paid }).Select(g => new MonthlyLeaveByType(g.Key.Code, g.Key.Paid, g.Sum(x => x.Days))).ToList();
        return new LeaveMonthlySummaryDto(employeeId, month, byType.Where(b => b.Paid).Sum(b => b.Days), byType.Where(b => !b.Paid).Sum(b => b.Days), byType);
    }

    /// <summary>Balance + upcoming + pending gathered concurrently; a failing section degrades the overview instead of failing it.</summary>
    public async Task<LeaveOverviewDto> OverviewAsync(string employeeId, int year, CancellationToken ct)
    {
        var unavailable = new List<string>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // one DbContext (not thread-safe) serves this request, so the sections run one after another; each is isolated from the others' failures
        var bal = await Guard("balances", () => balances.ForEmployeeAsync(employeeId, year, ct), unavailable);
        var up = await Guard("upcoming", () => CalendarQueryAsync(today, today.AddDays(60), [employeeId], ct), unavailable);
        var pending = await Guard("pending", async () => (await db.LeaveApplications.AsNoTracking().Where(a => a.EmployeeId == employeeId && a.Status == "PENDING").ToListAsync(ct)).Select(ToDto).ToList(), unavailable);
        return new LeaveOverviewDto(bal, up, pending, unavailable);
    }

    private static async Task<T?> Guard<T>(string name, Func<Task<T>> f, List<string> unavailable) where T : class
    {
        try { return await f(); } catch (Exception ex) when (ex is not OperationCanceledException) { unavailable.Add(name); return null; }
    }
}

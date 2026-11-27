using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.TimesheetService.Clients;
using HR.TimesheetService.Data;
using HR.TimesheetService.DTOs;
using HR.TimesheetService.Entities;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.TimesheetService.Services;

public interface ITimesheetService
{
    Task<TimesheetViewDto> GetWeekAsync(string? employeeId, DateOnly weekStart, CancellationToken ct);
    Task<TimesheetViewDto> SaveWeekAsync(DateOnly weekStart, List<EntryRequest> entries, CancellationToken ct);
    Task<TimesheetViewDto> DeleteEntryAsync(string entryId, CancellationToken ct);
    Task<TimesheetViewDto> SubmitAsync(string id, CancellationToken ct);
    Task<TimesheetViewDto> DecideAsync(string id, bool approve, string? comment, CancellationToken ct);
    Task<TimesheetViewDto> ReopenAsync(string id, string reason, CancellationToken ct);
    Task<TimesheetViewDto> GetAsync(string id, CancellationToken ct);
    Task<PagedResult<TimesheetDto>> ListAsync(TimesheetListQuery q, CancellationToken ct);
    Task<List<TimesheetDto>> PendingApprovalsAsync(CancellationToken ct);
    Task<EmployeeHoursSummaryDto> EmployeeSummaryAsync(string employeeId, DateOnly fromDate, DateOnly toDate, CancellationToken ct);
    Task<ProjectSummaryDto> ProjectSummaryAsync(string projectId, DateOnly fromDate, DateOnly toDate, CancellationToken ct);
    Task<List<TaskDto>> ListTasksAsync(string projectId, CancellationToken ct);
    Task<TaskDto> CreateTaskAsync(string projectId, TaskRequest r, CancellationToken ct);
    Task<TaskDto> UpdateTaskAsync(string id, TaskUpdateRequest r, CancellationToken ct);
}

public sealed class TimesheetService(TimesheetDbContext db, ICurrentUser user, IProjectClient projects, IAdoNet ado, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow, IConfiguration cfg) : ITimesheetService
{
    private decimal MaxPerDay => cfg.GetValue("Timesheet:MaxHoursPerDay", 16m);
    private decimal MaxPerWeek => cfg.GetValue("Timesheet:MaxHoursPerWeek", 80m);
    private static TimesheetDto ToDto(Timesheet t) => t.Adapt<TimesheetDto>();
    private static TaskDto ToDto(TimesheetTask t) => new(t.Id, t.ProjectId, t.Code, t.Name, t.Billable, t.Active);
    private string RequireEmployee() => user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");

    public static DateOnly WeekStartOf(DateOnly d) { var diff = ((int)d.DayOfWeek + 6) % 7; return d.AddDays(-diff); }   // Monday

    private async Task<bool> CanApproveAsync(Timesheet sheet, CancellationToken ct)
    {
        if (sheet.EmployeeId == user.EmployeeId) return false;
        if (sheet.ApproverId == user.EmployeeId || user.IsSuperAdmin) return true;
        if (!user.HasPermission(Perm.TimesheetApprove)) return false;
        var me = user.EmployeeId ?? "-";
        return await db.TimesheetEntries.AnyAsync(e => e.TimesheetId == sheet.Id && e.ProjectManagerId == me, ct);   // the project manager of any project on the sheet
    }

    private async Task AssertViewAsync(Timesheet sheet, CancellationToken ct)
    {
        if (sheet.EmployeeId == user.EmployeeId || user.HasPermission(Perm.ReportView) || user.IsSuperAdmin || await CanApproveAsync(sheet, ct)) return;
        throw new ForbiddenException("You are not allowed to view this timesheet");
    }

    /// <summary>Validates every entry: dates inside the week and not future, no duplicates, daily/weekly limits, then the employee's allocation per (project, date) through concurrent calls to the Project Service.</summary>
    private async Task<Dictionary<string, AllocationCheck>> ValidateEntriesAsync(string employeeId, DateOnly ws, List<EntryRequest> list, CancellationToken ct)
    {
        var we = ws.AddDays(6); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var seen = new HashSet<string>(); var daily = new Dictionary<DateOnly, decimal>();
        foreach (var e in list)
        {
            var d = e.WorkDate!.Value;
            if (d < ws || d > we) throw new Common.Common.ValidationException($"Entry date {d:yyyy-MM-dd} is outside the week {ws:yyyy-MM-dd}..{we:yyyy-MM-dd}");
            if (d > today) throw new Common.Common.ValidationException($"Entry date {d:yyyy-MM-dd} is in the future");
            if (!seen.Add($"{e.ProjectId}|{e.TaskId ?? e.TaskKey}|{d}")) throw new ConflictException($"Duplicate entry for project/task on {d:yyyy-MM-dd}");
            daily[d] = daily.GetValueOrDefault(d) + e.Hours!.Value;
        }
        foreach (var (d, h) in daily) if (h > MaxPerDay) throw new BusinessRuleException($"{d:yyyy-MM-dd}: {h}h exceeds the daily limit of {MaxPerDay}h");
        var total = list.Sum(e => e.Hours!.Value);
        if (total > MaxPerWeek) throw new BusinessRuleException($"Weekly total {total}h exceeds the limit of {MaxPerWeek}h");

        var pairs = list.Select(e => (e.ProjectId, Date: e.WorkDate!.Value)).Distinct().ToList();
        var checks = await Task.WhenAll(pairs.Select(async p => (Key: $"{p.ProjectId}|{p.Date}", Check: await projects.CheckAsync(p.ProjectId, employeeId, p.Date, ct))));
        var map = checks.ToDictionary(c => c.Key, c => c.Check);
        foreach (var (key, c) in map)
            if (!c.Allocated) throw new BusinessRuleException($"You are not allocated to project {c.ProjectCode} on {key.Split('|')[1]} (or the project is not active)");
        foreach (var e in list.Where(x => x.TaskId is not null))
        {
            var task = await db.TimesheetTasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == e.TaskId, ct);
            if (task is null || task.ProjectId != e.ProjectId || !task.Active) throw new Common.Common.ValidationException($"Task {e.TaskId} is not valid for project {e.ProjectId}");
        }
        return map;
    }

    private async Task<TimesheetViewDto> ViewAsync(Timesheet sheet, CancellationToken ct)
    {
        var entries = await db.TimesheetEntries.AsNoTracking().Where(e => e.TimesheetId == sheet.Id).OrderBy(e => e.WorkDate).ThenBy(e => e.ProjectId).ToListAsync(ct);
        var history = await db.TimesheetHistories.AsNoTracking().Where(h => h.TimesheetId == sheet.Id).OrderBy(h => h.CreatedAt).Select(h => new HistoryDto(h.Id, h.Action, h.ActorId, h.Comment, h.CreatedAt)).ToListAsync(ct);
        var byDay = entries.GroupBy(e => e.WorkDate).OrderBy(g => g.Key).Select(g => new DailyTotalDto(g.Key, g.Sum(x => x.Hours))).ToList();
        return new TimesheetViewDto(ToDto(sheet), sheet.WeekStart, sheet.EmployeeId, sheet.Status, entries.Select(e => new EntryDto(e.Id, e.ProjectId, e.TaskId, e.TaskKey, e.WorkDate, e.Hours, e.Billable, e.Description)).ToList(), byDay, history, sheet.TotalHours);
    }

    public async Task<TimesheetViewDto> GetWeekAsync(string? employeeId, DateOnly weekStart, CancellationToken ct)
    {
        var target = employeeId ?? RequireEmployee();
        var monday = WeekStartOf(weekStart);
        var sheet = await db.Timesheets.AsNoTracking().FirstOrDefaultAsync(t => t.EmployeeId == target && t.WeekStart == monday, ct);
        if (sheet is null)
        {
            if (target != user.EmployeeId && !user.HasPermission(Perm.ReportView) && !user.IsSuperAdmin) throw new ForbiddenException();
            return new TimesheetViewDto(null, monday, target, "NOT_STARTED", [], [], [], 0);
        }
        await AssertViewAsync(sheet, ct);
        return await ViewAsync(sheet, ct);
    }

    /// <summary>Replaces the week's entries (DRAFT or REJECTED only). The timesheet is created on first save; one sheet per employee and week.</summary>
    public async Task<TimesheetViewDto> SaveWeekAsync(DateOnly rawWeek, List<EntryRequest> list, CancellationToken ct)
    {
        var employeeId = RequireEmployee(); var ws = WeekStartOf(rawWeek);
        var emp = await db.TimesheetEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId, ct) ?? throw new NotFoundException("Employee not found");
        if (emp.Status is not ("ACTIVE" or "ON_NOTICE")) throw new BusinessRuleException("Only active employees can log time");
        var checks = await ValidateEntriesAsync(employeeId, ws, list, ct);
        string sheetId = "";
        await uow.ExecuteAsync(async () =>
        {
            var sheet = (await db.Timesheets.FromSqlInterpolated($"SELECT * FROM timesheets WHERE employee_id = {employeeId} AND week_start = {ws} FOR UPDATE").ToListAsync(ct)).FirstOrDefault();
            if (sheet is not null && sheet.Status is not ("DRAFT" or "REJECTED")) throw new BusinessRuleException($"A {sheet.Status} timesheet cannot be edited; reopen it first");
            if (sheet is null)
            {
                sheet = new Timesheet { EmployeeId = employeeId, EmployeeName = emp.FullName, WeekStart = ws, Status = "DRAFT", ApproverId = emp.ManagerId };
                db.Timesheets.Add(sheet);
                await db.SaveChangesAsync(ct);
                db.TimesheetHistories.Add(new TimesheetHistory { TimesheetId = sheet.Id, Action = "CREATED", ActorId = user.UserId });
            }
            db.TimesheetEntries.RemoveRange(await db.TimesheetEntries.Where(e => e.TimesheetId == sheet.Id).ToListAsync(ct));
            await db.SaveChangesAsync(ct);
            foreach (var e in list)
            {
                var c = checks[$"{e.ProjectId}|{e.WorkDate}"];
                var task = e.TaskId is null ? null : await db.TimesheetTasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == e.TaskId, ct);
                db.TimesheetEntries.Add(new TimesheetEntry { TimesheetId = sheet.Id, EmployeeId = employeeId, ProjectId = e.ProjectId, ProjectManagerId = c.ProjectManagerId, TaskId = e.TaskId,
                    TaskKey = task?.Code ?? e.TaskKey!, WorkDate = e.WorkDate!.Value, Hours = e.Hours!.Value, Billable = e.Billable && c.Billable, Description = e.Description });
            }
            sheet.TotalHours = list.Sum(e => e.Hours!.Value); sheet.BillableHours = list.Where(e => e.Billable && checks[$"{e.ProjectId}|{e.WorkDate}"].Billable).Sum(e => e.Hours!.Value);
            sheet.ApproverId = emp.ManagerId;
            db.TimesheetHistories.Add(new TimesheetHistory { TimesheetId = sheet.Id, Action = "ENTRIES_SAVED", ActorId = user.UserId });
            await db.SaveChangesAsync(ct);
            sheetId = sheet.Id;
        }, ct);
        return await ViewAsync(await db.Timesheets.AsNoTracking().FirstAsync(t => t.Id == sheetId, ct), ct);
    }

    public async Task<TimesheetViewDto> DeleteEntryAsync(string entryId, CancellationToken ct)
    {
        var e = await db.TimesheetEntries.FirstOrDefaultAsync(x => x.Id == entryId, ct) ?? throw new NotFoundException("Entry not found");
        var sheet = await db.Timesheets.FirstAsync(t => t.Id == e.TimesheetId, ct);
        if (sheet.EmployeeId != user.EmployeeId) throw new ForbiddenException();
        if (sheet.Status is not ("DRAFT" or "REJECTED")) throw new BusinessRuleException("Only draft or rejected timesheets can be edited");
        db.TimesheetEntries.Remove(e);
        await db.SaveChangesAsync(ct);
        var rest = await db.TimesheetEntries.AsNoTracking().Where(x => x.TimesheetId == sheet.Id).ToListAsync(ct);
        sheet.TotalHours = rest.Sum(x => x.Hours); sheet.BillableHours = rest.Where(x => x.Billable).Sum(x => x.Hours);
        await db.SaveChangesAsync(ct);
        return await ViewAsync(sheet, ct);
    }

    public async Task<TimesheetViewDto> SubmitAsync(string id, CancellationToken ct)
    {
        var sheet = await db.Timesheets.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Timesheet not found");
        if (sheet.EmployeeId != user.EmployeeId) throw new ForbiddenException("Only the owner can submit a timesheet");
        if (sheet.Status is not ("DRAFT" or "REJECTED")) throw new ConflictException($"Timesheet is already {sheet.Status}");
        if (sheet.TotalHours <= 0) throw new BusinessRuleException("Cannot submit an empty timesheet");
        var resub = sheet.Status == "REJECTED";
        var mgr = await db.TimesheetEmployees.AsNoTracking().Where(e => e.EmployeeId == sheet.EmployeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
        await uow.ExecuteAsync(async () =>
        {
            sheet.Status = "SUBMITTED"; sheet.SubmittedAt = DateTime.UtcNow; sheet.ApproverId = mgr ?? sheet.ApproverId; sheet.DecidedAt = null; sheet.DecisionComment = null;
            if (resub) sheet.ResubmissionCount++;
            db.TimesheetHistories.Add(new TimesheetHistory { TimesheetId = id, Action = resub ? "RESUBMITTED" : "SUBMITTED", ActorId = user.UserId });
            events.Publish(Topics.TimesheetSubmitted, sheet.EmployeeId, new TimesheetEvent(id, sheet.EmployeeId, mgr, sheet.WeekStart, sheet.TotalHours, sheet.BillableHours, "SUBMITTED", null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Timesheet", id, resub ? "RESUBMITTED" : "SUBMITTED");
        }, ct);
        return await ViewAsync(sheet, ct);
    }

    public async Task<TimesheetViewDto> DecideAsync(string id, bool approve, string? comment, CancellationToken ct)
    {
        var sheet = await db.Timesheets.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Timesheet not found");
        if (sheet.Status != "SUBMITTED") throw new BusinessRuleException($"Timesheet is {sheet.Status}");
        if (!await CanApproveAsync(sheet, ct)) throw new ForbiddenException("You are not an approver for this timesheet");
        await uow.ExecuteAsync(async () =>
        {
            sheet.Status = approve ? "APPROVED" : "REJECTED"; sheet.ApproverId = user.EmployeeId ?? sheet.ApproverId; sheet.DecidedAt = DateTime.UtcNow; sheet.DecisionComment = comment;
            db.TimesheetHistories.Add(new TimesheetHistory { TimesheetId = id, Action = approve ? "APPROVED" : "REJECTED", ActorId = user.UserId, Comment = comment });
            if (approve) events.Publish(Topics.TimesheetApproved, sheet.EmployeeId, new TimesheetEvent(id, sheet.EmployeeId, sheet.ApproverId, sheet.WeekStart, sheet.TotalHours, sheet.BillableHours, "APPROVED", comment));
            else events.Publish(Topics.NotificationRequested, sheet.EmployeeId, new NotificationRequestedEvent(sheet.EmployeeId, null, "TIMESHEET_REJECTED", "IN_APP", "Timesheet rejected",
                $"Your timesheet for the week of {sheet.WeekStart:yyyy-MM-dd} was rejected: {comment}", null, "Timesheet", id, null));
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Timesheet", id, approve ? "APPROVED" : "REJECTED", null, new { comment });
        }, ct);
        return await ViewAsync(sheet, ct);
    }

    /// <summary>Correction: the owner retracts a submitted sheet; the approver can reopen an approved one.</summary>
    public async Task<TimesheetViewDto> ReopenAsync(string id, string reason, CancellationToken ct)
    {
        var sheet = await db.Timesheets.FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Timesheet not found");
        var owner = sheet.EmployeeId == user.EmployeeId;
        var allowed = (sheet.Status == "SUBMITTED" && owner) || (sheet.Status is "SUBMITTED" or "APPROVED" && await CanApproveAsync(sheet, ct));
        if (!allowed) throw new ForbiddenException("You cannot reopen this timesheet");
        var from = sheet.Status;
        await uow.ExecuteAsync(async () =>
        {
            sheet.Status = "DRAFT"; sheet.DecidedAt = null;
            db.TimesheetHistories.Add(new TimesheetHistory { TimesheetId = id, Action = "REOPENED", ActorId = user.UserId, Comment = reason });
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Timesheet", id, "REOPENED", new { status = from }, new { reason });
        }, ct);
        return await ViewAsync(sheet, ct);
    }

    public async Task<TimesheetViewDto> GetAsync(string id, CancellationToken ct)
    {
        var s = await db.Timesheets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Timesheet not found");
        await AssertViewAsync(s, ct);
        return await ViewAsync(s, ct);
    }

    public async Task<PagedResult<TimesheetDto>> ListAsync(TimesheetListQuery q, CancellationToken ct)
    {
        var query = db.Timesheets.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(t => t.Status == q.Status);
        if (q.From is { } f) query = query.Where(t => t.WeekStart >= f);
        if (q.To is { } to) query = query.Where(t => t.WeekStart <= to);
        if (user.HasPermission(Perm.ReportView) || user.IsSuperAdmin) { if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(t => t.EmployeeId == q.EmployeeId); }
        else if (!string.IsNullOrEmpty(q.EmployeeId) && q.EmployeeId != user.EmployeeId)
        {
            var mgr = await db.TimesheetEmployees.AsNoTracking().Where(e => e.EmployeeId == q.EmployeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            if (mgr != user.EmployeeId) throw new ForbiddenException();
            query = query.Where(t => t.EmployeeId == q.EmployeeId);
        }
        else { var me = user.EmployeeId ?? "-"; query = query.Where(t => t.EmployeeId == me); }
        query = query.OrderByAllowed(q.Sort ?? "WeekStart", q.Sort is null || q.Descending, ["WeekStart", "Status", "TotalHours", "SubmittedAt"], "WeekStart");
        return await query.ToPagedAsync(q, t => new TimesheetDto(t.Id, t.EmployeeId, t.EmployeeName, t.WeekStart, t.Status, t.TotalHours, t.BillableHours, t.ApproverId, t.SubmittedAt, t.DecidedAt, t.DecisionComment, t.ResubmissionCount, t.Version), ct);
    }

    public async Task<List<TimesheetDto>> PendingApprovalsAsync(CancellationToken ct)
    {
        var me = user.EmployeeId ?? "-";
        var rows = await db.Timesheets.AsNoTracking().Where(t => t.Status == "SUBMITTED" && t.EmployeeId != me &&
            (t.ApproverId == me || db.TimesheetEntries.Any(e => e.TimesheetId == t.Id && e.ProjectManagerId == me))).OrderBy(t => t.SubmittedAt).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    // ------------------------------------------------------------------ reports
    /// <summary>Work-hour summary: the existing stored procedure plus a per-project split.</summary>
    public async Task<EmployeeHoursSummaryDto> EmployeeSummaryAsync(string employeeId, DateOnly fromDate, DateOnly toDate, CancellationToken ct)
    {
        if (employeeId != user.EmployeeId && !user.HasPermission(Perm.ReportView) && !user.IsSuperAdmin)
        {
            var mgr = await db.TimesheetEmployees.AsNoTracking().Where(e => e.EmployeeId == employeeId).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
            if (mgr != user.EmployeeId) throw new ForbiddenException();
        }
        var proc = await ado.CallProcedureAsync("sp_timesheet_summary", r => r.ToDictionary(), new { p_employee_id = employeeId, p_from = fromDate.ToDateTime(TimeOnly.MinValue), p_to = toDate.ToDateTime(TimeOnly.MinValue) }, ct);
        var byProject = await (from e in db.TimesheetEntries.AsNoTracking() join t in db.Timesheets on e.TimesheetId equals t.Id
                               where e.EmployeeId == employeeId && e.WorkDate >= fromDate && e.WorkDate <= toDate && (t.Status == "SUBMITTED" || t.Status == "APPROVED")
                               group e by e.ProjectId into g select new ProjectHoursDto(g.Key, g.Sum(x => x.Hours), g.Where(x => x.Billable).Sum(x => x.Hours))).ToListAsync(ct);
        return new EmployeeHoursSummaryDto(employeeId, fromDate, toDate, proc, byProject);
    }

    public async Task<ProjectSummaryDto> ProjectSummaryAsync(string projectId, DateOnly fromDate, DateOnly toDate, CancellationToken ct)
    {
        if (!user.HasAnyPermission(Perm.ReportView, Perm.ProjectManage) && !user.IsSuperAdmin) throw new ForbiddenException();
        var rows = await (from e in db.TimesheetEntries.AsNoTracking() join t in db.Timesheets on e.TimesheetId equals t.Id
                          where e.ProjectId == projectId && e.WorkDate >= fromDate && e.WorkDate <= toDate && (t.Status == "SUBMITTED" || t.Status == "APPROVED")
                          group new { e, t } by new { e.EmployeeId, t.EmployeeName } into g
                          select new EmployeeHoursDto(g.Key.EmployeeId, g.Key.EmployeeName, g.Sum(x => x.e.Hours), g.Where(x => x.e.Billable).Sum(x => x.e.Hours))).ToListAsync(ct);
        return new ProjectSummaryDto(projectId, fromDate, toDate, rows.Sum(r => r.TotalHours), rows.Sum(r => r.BillableHours), rows);
    }

    // ------------------------------------------------------------------ tasks
    public async Task<List<TaskDto>> ListTasksAsync(string projectId, CancellationToken ct) =>
        (await db.TimesheetTasks.AsNoTracking().Where(t => t.ProjectId == projectId && t.Active).OrderBy(t => t.Code).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<TaskDto> CreateTaskAsync(string projectId, TaskRequest r, CancellationToken ct)
    {
        if (await db.TimesheetTasks.IgnoreQueryFilters().AnyAsync(t => t.ProjectId == projectId && t.Code == r.Code, ct)) throw new ConflictException("Task code already exists for this project");
        var t = new TimesheetTask { ProjectId = projectId, Code = r.Code, Name = r.Name, Billable = r.Billable, Active = r.Active };
        db.TimesheetTasks.Add(t);
        await db.SaveChangesAsync(ct);
        return ToDto(t);
    }

    public async Task<TaskDto> UpdateTaskAsync(string id, TaskUpdateRequest r, CancellationToken ct)
    {
        var t = await db.TimesheetTasks.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Task not found");
        t.Name = r.Name ?? t.Name; if (r.Billable is { } b) t.Billable = b; if (r.Active is { } a) t.Active = a;
        await db.SaveChangesAsync(ct);
        return ToDto(t);
    }
}

public sealed class TimesheetEmployeeReadModel(TimesheetDbContext db) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.TimesheetEmployees.FirstOrDefaultAsync(x => x.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new TimesheetEmployee { EmployeeId = e.EmployeeId }; db.TimesheetEmployees.Add(row); }
        row.FullName = e.FullName; row.ManagerId = e.ManagerId; row.Status = e.Status;
        await db.SaveChangesAsync(ct);
    }
}

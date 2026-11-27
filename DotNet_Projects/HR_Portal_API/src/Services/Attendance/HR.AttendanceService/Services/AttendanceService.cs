using HR.AttendanceService.Data;
using HR.AttendanceService.DTOs;
using HR.AttendanceService.Entities;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.AttendanceService.Services;

public interface IAttendanceService
{
    Task<AttendanceRecordDto> CheckInAsync(CheckInRequest r, CancellationToken ct);
    Task<AttendanceRecordDto> CheckOutAsync(CheckOutRequest r, CancellationToken ct);
    Task<TodayDto> TodayAsync(CancellationToken ct);
    Task<PagedResult<AttendanceRecordDto>> ListAsync(RecordsQuery q, CancellationToken ct);
    Task<MonthlyDto> MonthlyAsync(MonthQuery q, CancellationToken ct);
    Task<List<CalendarDayDto>> CalendarAsync(MonthQuery q, CancellationToken ct);
    Task<TeamReportDto> TeamReportAsync(TeamQuery q, CancellationToken ct);
    Task<PayrollInputDto> PayrollInputAsync(string employeeId, string month, CancellationToken ct);
    Task<int> MarkMissingPunchesAsync(CancellationToken ct);
    Task<AttendanceRecord> ApplyCorrectionAsync(string employeeId, DateOnly workDate, DateTime checkIn, DateTime checkOut, CancellationToken ct);
    Task EvictSummaryAsync(string employeeId);
    Task<Shift> ShiftForAsync(string employeeId, DateOnly date, CancellationToken ct);
    Task<string> AuthorizedEmployeeAsync(string? requested, CancellationToken ct);
}

public sealed class AttendanceService(AttendanceDbContext db, ICurrentUser user, OfficeTime office, IAdoNet ado, ICacheService cache, IEventPublisher events, IAuditWriter audit, IUnitOfWork uow) : IAttendanceService
{
    private static AttendanceRecordDto ToDto(AttendanceRecord r) => r.Adapt<AttendanceRecordDto>();
    private string RequireEmployee() => user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");

    public async Task<Shift> ShiftForAsync(string employeeId, DateOnly date, CancellationToken ct)
    {
        var assigned = await (from a in db.ShiftAssignments.AsNoTracking()
                              join s in db.Shifts on a.ShiftId equals s.Id
                              where a.EmployeeId == employeeId && a.EffectiveFrom <= date && (a.EffectiveTo == null || a.EffectiveTo >= date)
                              orderby a.EffectiveFrom descending select s).FirstOrDefaultAsync(ct);
        return assigned ?? await db.Shifts.AsNoTracking().Where(s => s.Active).OrderByDescending(s => s.IsDefault).ThenBy(s => s.CreatedAt).FirstOrDefaultAsync(ct)
               ?? throw new BusinessRuleException("No shift is configured");
    }

    /// <summary>Derives worked/late/early/overtime/status from the shift rules; overtime comes from the existing DB function fn_overtime_minutes.</summary>
    private async Task<(int Worked, int Late, int Early, int Overtime, string Status)> EvaluateAsync(Shift shift, DateTime checkIn, DateTime? checkOut, CancellationToken ct)
    {
        var start = OfficeTime.Minutes(shift.StartTime); var end = OfficeTime.Minutes(shift.EndTime);
        var inMin = office.MinuteOfDay(checkIn);
        var late = inMin - start - shift.GraceMinutes > 0 ? inMin - start : 0;
        if (checkOut is null) return (0, late, 0, 0, "PRESENT");
        var worked = (int)Math.Max(0, (checkOut.Value - checkIn).TotalMinutes);
        var early = Math.Max(0, end - office.MinuteOfDay(checkOut.Value));
        var overtime = await ado.ScalarAsync<int?>("SELECT fn_overtime_minutes(@w, @s, @t)", new { w = worked, s = shift.StandardMinutes, t = shift.OvertimeThresholdMinutes }, ct) ?? 0;
        var status = worked >= shift.FullDayMinutes ? "PRESENT" : worked >= shift.HalfDayMinutes ? "HALF_DAY" : "ABSENT";
        return (worked, late, early, overtime, status);
    }

    private async Task<AttendanceRecord?> LockDayAsync(string employeeId, DateOnly date, CancellationToken ct) =>
        (await db.AttendanceRecords.FromSqlInterpolated($"SELECT * FROM attendance_records WHERE employee_id = {employeeId} AND work_date = {date} FOR UPDATE").ToListAsync(ct)).FirstOrDefault();

    public async Task<AttendanceRecordDto> CheckInAsync(CheckInRequest r, CancellationToken ct)
    {
        var employeeId = RequireEmployee();
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId, ct);
        if (emp is null || emp.Status is not ("ACTIVE" or "ON_NOTICE")) throw new BusinessRuleException("Only active employees can check in");
        var now = DateTime.UtcNow; var date = office.DateOf(now);
        if (await db.ApprovedLeaveDays.AnyAsync(l => l.EmployeeId == employeeId && l.LeaveDate == date, ct)) throw new ConflictException("You are on approved leave today");
        if (r.WorkMode == "WFH" && !await db.WfhRequests.AnyAsync(w => w.EmployeeId == employeeId && w.Status == "APPROVED" && w.FromDate <= date && w.ToDate >= date, ct))
            throw new BusinessRuleException("No approved work-from-home request covers today");
        var shift = await ShiftForAsync(employeeId, date, ct);
        var holiday = await db.HolidaySnapshots.AsNoTracking().FirstOrDefaultAsync(h => h.HolidayDate == date && (h.LocationId == null || h.LocationId == emp.LocationId), ct);
        var (_, late, _, _, _) = await EvaluateAsync(shift, now, null, ct);
        AttendanceRecord rec = null!;
        await uow.ExecuteAsync(async () =>
        {
            var existing = await LockDayAsync(employeeId, date, ct);
            if (existing?.CheckIn is not null) throw new ConflictException("You have already checked in today");
            var remarks = r.Remarks ?? (holiday is null ? null : $"Worked on holiday: {holiday.Name}");
            if (existing is null)
            {
                existing = new AttendanceRecord { EmployeeId = employeeId, WorkDate = date, Source = "WEB" };
                db.AttendanceRecords.Add(existing);
            }
            existing.CheckIn = now; existing.Status = "PRESENT"; existing.WorkMode = r.WorkMode; existing.LateMinutes = late; existing.ShiftId = shift.Id; existing.Remarks = remarks;
            events.Publish(Topics.AttendanceCheckedIn, employeeId, new AttendanceEvent(employeeId, date, now, null, "PRESENT", 0, late, 0, 0, null));
            await db.SaveChangesAsync(ct);
            rec = existing;
        }, ct);
        await EvictSummaryAsync(employeeId);
        return ToDto(rec);
    }

    public async Task<AttendanceRecordDto> CheckOutAsync(CheckOutRequest r, CancellationToken ct)
    {
        var employeeId = RequireEmployee();
        var now = DateTime.UtcNow; var date = office.DateOf(now);
        AttendanceRecord rec = null!;
        await uow.ExecuteAsync(async () =>
        {
            var existing = await LockDayAsync(employeeId, date, ct);
            if (existing?.CheckIn is null) throw new BusinessRuleException("You have not checked in today");
            if (existing.CheckOut is not null) throw new ConflictException("You have already checked out today");
            var shift = existing.ShiftId is null ? await ShiftForAsync(employeeId, date, ct) : await db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == existing.ShiftId, ct) ?? await ShiftForAsync(employeeId, date, ct);
            var ev = await EvaluateAsync(shift, existing.CheckIn.Value, now, ct);
            existing.CheckOut = now; existing.WorkedMinutes = ev.Worked; existing.LateMinutes = ev.Late; existing.EarlyDepartureMinutes = ev.Early; existing.OvertimeMinutes = ev.Overtime;
            existing.Status = ev.Status; existing.Remarks = r.Remarks ?? existing.Remarks;
            events.Publish(Topics.AttendanceCheckedOut, employeeId, new AttendanceEvent(employeeId, date, existing.CheckIn, now, ev.Status, ev.Worked, ev.Late, ev.Early, ev.Overtime, null));
            await db.SaveChangesAsync(ct);
            rec = existing;
        }, ct);
        await EvictSummaryAsync(employeeId);
        return ToDto(rec);
    }

    public async Task<TodayDto> TodayAsync(CancellationToken ct)
    {
        var employeeId = RequireEmployee();
        var date = office.Today;
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId, ct);
        var rec = await db.AttendanceRecords.AsNoTracking().FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.WorkDate == date, ct);
        var holiday = await db.HolidaySnapshots.AsNoTracking().FirstOrDefaultAsync(h => h.HolidayDate == date && (h.LocationId == null || h.LocationId == emp!.LocationId), ct);
        var onLeave = await db.ApprovedLeaveDays.AnyAsync(l => l.EmployeeId == employeeId && l.LeaveDate == date, ct);
        Shift? shift = null;
        try { shift = await ShiftForAsync(employeeId, date, ct); } catch (BusinessRuleException) { }
        return new TodayDto(date, rec is null ? null : ToDto(rec), holiday is null ? null : new HolidayLite(holiday.HolidayId, holiday.HolidayDate, holiday.Name), onLeave,
            shift is null ? null : new ShiftLite(shift.Id, shift.Code, shift.Name, shift.StartTime, shift.EndTime, shift.WeeklyOffs), date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday);
    }

    /// <summary>Self, the employee's manager, or HR.</summary>
    public async Task<string> AuthorizedEmployeeAsync(string? requested, CancellationToken ct)
    {
        var target = requested ?? user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        if (target == user.EmployeeId || user.HasPermission(Perm.AttendanceManage) || user.IsSuperAdmin) return target;
        var mgr = await db.AttendanceEmployees.AsNoTracking().Where(e => e.EmployeeId == target).Select(e => e.ManagerId).FirstOrDefaultAsync(ct);
        if (mgr is not null && mgr == user.EmployeeId) return target;
        throw new ForbiddenException("You may only view your own or your team's attendance");
    }

    public async Task<PagedResult<AttendanceRecordDto>> ListAsync(RecordsQuery q, CancellationToken ct)
    {
        var employeeId = await AuthorizedEmployeeAsync(q.EmployeeId, ct);
        var query = db.AttendanceRecords.AsNoTracking().Where(a => a.EmployeeId == employeeId);
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(a => a.Status == q.Status);
        if (q.From is { } f) query = query.Where(a => a.WorkDate >= f);
        if (q.To is { } t) query = query.Where(a => a.WorkDate <= t);
        query = query.OrderByAllowed(q.Sort ?? "WorkDate", q.Sort is null || q.Descending, ["WorkDate", "CheckIn", "Status", "WorkedMinutes"], "WorkDate");
        return await query.ToPagedAsync(q, a => new AttendanceRecordDto(a.Id, a.EmployeeId, a.WorkDate, a.CheckIn, a.CheckOut, a.Status, a.WorkMode, a.ShiftId, a.WorkedMinutes, a.LateMinutes,
            a.EarlyDepartureMinutes, a.OvertimeMinutes, a.Source, a.Remarks), ct);
    }

    private static (DateOnly From, DateOnly To) MonthRange(string month)
    {
        var first = DateOnly.ParseExact(month + "-01", "yyyy-MM-dd");
        return (first, first.AddMonths(1).AddDays(-1));
    }

    private async Task RunSummaryProcedureAsync(string employeeId, int year, int month, string? locationId, CancellationToken ct) =>
        await ado.CallProcedureNonQueryAsync("sp_monthly_attendance_summary", new { p_employee_id = employeeId, p_year = year, p_month = month, p_location_id = locationId ?? "" }, ct);

    /// <summary>Runs the existing stored procedure (upserts monthly_attendance_summary) and reads the summary view.</summary>
    public async Task<MonthlyDto> MonthlyAsync(MonthQuery q, CancellationToken ct)
    {
        var employeeId = await AuthorizedEmployeeAsync(q.EmployeeId, ct);
        var month = q.Month ?? office.Today.ToString("yyyy-MM");
        var cached = q.Refresh ? null : await cache.GetAsync<MonthlyDto>($"att:summary:{employeeId}:{month}", ct);
        if (cached is not null) return cached;
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId, ct) ?? throw new NotFoundException("Employee not found");
        var (from, to) = MonthRange(month);
        await RunSummaryProcedureAsync(employeeId, from.Year, from.Month, emp.LocationId, ct);
        var sum = await db.VwMonthlyAttendanceSummaries.AsNoTracking().FirstOrDefaultAsync(s => s.EmployeeId == employeeId && s.SummaryYear == from.Year && s.SummaryMonth == from.Month, ct);
        var records = await db.AttendanceRecords.AsNoTracking().Where(a => a.EmployeeId == employeeId && a.WorkDate >= from && a.WorkDate <= to).OrderBy(a => a.WorkDate).ToListAsync(ct);
        var dto = new MonthlyDto(employeeId, month, sum is null ? null : new MonthlySummaryDto(sum.EmployeeId, sum.SummaryYear, sum.SummaryMonth, sum.WorkingDays, sum.PresentDays, sum.HalfDays, sum.AbsentDays,
            sum.LeaveDays, sum.Holidays, sum.WeeklyOffs, sum.WfhDays, sum.MissingPunches, sum.LateCount, sum.OvertimeMinutes, sum.AttendancePercent, sum.GeneratedAt), records.Select(ToDto).ToList());
        await cache.SetAsync($"att:summary:{employeeId}:{month}", dto, TimeSpan.FromMinutes(5), ct);
        return dto;
    }

    /// <summary>Per-day calendar: attendance record, holiday, approved leave and weekly-off flags.</summary>
    public async Task<List<CalendarDayDto>> CalendarAsync(MonthQuery q, CancellationToken ct)
    {
        var employeeId = await AuthorizedEmployeeAsync(q.EmployeeId, ct);
        var month = q.Month ?? office.Today.ToString("yyyy-MM");
        var (from, to) = MonthRange(month);
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId, ct);
        var recs = (await db.AttendanceRecords.AsNoTracking().Where(a => a.EmployeeId == employeeId && a.WorkDate >= from && a.WorkDate <= to).ToListAsync(ct)).ToDictionary(r => r.WorkDate);
        var hols = (await db.HolidaySnapshots.AsNoTracking().Where(h => h.HolidayDate >= from && h.HolidayDate <= to && (h.LocationId == null || h.LocationId == emp!.LocationId)).ToListAsync(ct))
            .GroupBy(h => h.HolidayDate).ToDictionary(g => g.Key, g => g.First());
        var leaves = (await db.ApprovedLeaveDays.AsNoTracking().Where(l => l.EmployeeId == employeeId && l.LeaveDate >= from && l.LeaveDate <= to).Select(l => l.LeaveDate).ToListAsync(ct)).ToHashSet();
        var shift = await ShiftForAsync(employeeId, from, ct);
        // weekly offs ("SAT,SUN") packed into a 7-bit mask (Sunday = bit 0) with a BitArray: O(1) lookup per day
        var offs = new System.Collections.BitArray(7);
        foreach (var d in shift.WeeklyOffs.Split(',', StringSplitOptions.RemoveEmptyEntries)) offs[(int)Enum.GetValues<DayOfWeek>().First(x => x.ToString()[..3].Equals(d, StringComparison.OrdinalIgnoreCase))] = true;
        var today = office.Today;
        var days = new List<CalendarDayDto>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            recs.TryGetValue(d, out var r);
            var type = r is not null ? r.Status : hols.ContainsKey(d) ? "HOLIDAY" : offs[(int)d.DayOfWeek] ? "WEEKLY_OFF" : leaves.Contains(d) ? "LEAVE" : d < today ? "ABSENT" : "UPCOMING";
            days.Add(new CalendarDayDto(d, type, hols.GetValueOrDefault(d)?.Name, r?.CheckIn, r?.CheckOut, r?.WorkedMinutes ?? 0, r?.WorkMode));
        }
        return days;
    }

    /// <summary>Manager/HR team report: today's status per member + month totals aggregated with PLINQ/Parallel for large teams.</summary>
    public async Task<TeamReportDto> TeamReportAsync(TeamQuery q, CancellationToken ct)
    {
        var hr = user.HasPermission(Perm.AttendanceManage) || user.IsSuperAdmin;
        var me = user.EmployeeId ?? "-";
        var team = await db.AttendanceEmployees.AsNoTracking().Where(e => hr ? (e.Status == "ACTIVE" || e.Status == "ON_NOTICE") : e.ManagerId == me).Take(2000).ToListAsync(ct);
        var day = q.Date ?? office.Today; var month = q.Month ?? day.ToString("yyyy-MM"); var (from, to) = MonthRange(month);
        var ids = team.Select(t => t.EmployeeId).ToList();
        var dayRecs = (await db.AttendanceRecords.AsNoTracking().Where(r => r.WorkDate == day && ids.Contains(r.EmployeeId)).ToListAsync(ct)).ToDictionary(r => r.EmployeeId);
        var monthRecs = await db.AttendanceRecords.AsNoTracking().Where(r => r.WorkDate >= from && r.WorkDate <= to && ids.Contains(r.EmployeeId))
            .Select(r => new { r.EmployeeId, r.WorkedMinutes, r.LateMinutes, r.OvertimeMinutes }).ToListAsync(ct);
        // CPU-bound aggregation: PLINQ above a size threshold (parallel partitions), plain LINQ otherwise
        var totals = (monthRecs.Count > 500 ? monthRecs.AsParallel().GroupBy(r => r.EmployeeId) : monthRecs.GroupBy(r => r.EmployeeId).AsParallel().Select(g => g))
            .ToDictionary(g => g.Key, g => new TeamMonthTotals(g.Count(), g.Sum(x => (long)x.WorkedMinutes), g.Sum(x => (long)x.LateMinutes), g.Sum(x => (long)x.OvertimeMinutes)));
        var members = team.Select(t =>
        {
            dayRecs.TryGetValue(t.EmployeeId, out var r);
            return new TeamMemberDto(t.EmployeeId, t.FullName, r is null ? new TeamMemberDay("NOT_CHECKED_IN", null, null, null) : new TeamMemberDay(r.Status, r.CheckIn, r.CheckOut, r.WorkMode),
                totals.GetValueOrDefault(t.EmployeeId) ?? new TeamMonthTotals(0, 0, 0, 0));
        }).ToList();
        return new TeamReportDto(day, month, members.Count, members.Count(m => m.Today.Status is "PRESENT" or "HALF_DAY"), members);
    }

    /// <summary>Input for payroll: refreshes the stored-procedure summary and returns the figures payroll needs.</summary>
    public async Task<PayrollInputDto> PayrollInputAsync(string employeeId, string month, CancellationToken ct)
    {
        var emp = await db.AttendanceEmployees.AsNoTracking().FirstOrDefaultAsync(e => e.EmployeeId == employeeId, ct) ?? throw new NotFoundException("Employee not found");
        var (from, _) = MonthRange(month);
        await RunSummaryProcedureAsync(employeeId, from.Year, from.Month, emp.LocationId, ct);
        var s = await db.VwMonthlyAttendanceSummaries.AsNoTracking().FirstOrDefaultAsync(x => x.EmployeeId == employeeId && x.SummaryYear == from.Year && x.SummaryMonth == from.Month, ct);
        return new PayrollInputDto(employeeId, month, s?.WorkingDays ?? 0, s?.PresentDays ?? 0, s?.HalfDays ?? 0, s?.AbsentDays ?? 0, s?.LeaveDays ?? 0, s?.Holidays ?? 0, s?.OvertimeMinutes ?? 0);
    }

    /// <summary>Past days with a check-in but no check-out are flagged MISSING_PUNCH (scheduled job + manual endpoint).</summary>
    public async Task<int> MarkMissingPunchesAsync(CancellationToken ct)
    {
        var today = office.Today;
        var open = await db.AttendanceRecords.Where(r => r.CheckIn != null && r.CheckOut == null && r.Status != "MISSING_PUNCH" && r.WorkDate < today).ToListAsync(ct);
        foreach (var r in open) r.Status = "MISSING_PUNCH";
        if (open.Count == 0) return 0;
        await db.SaveChangesAsync(ct);
        foreach (var r in open) await audit.WriteAsync("AttendanceRecord", r.Id, "MISSING_PUNCH_FLAGGED");
        return open.Count;
    }

    /// <summary>Called when a correction is approved: rewrites the day with the requested punches (inside the caller's transaction).</summary>
    public async Task<AttendanceRecord> ApplyCorrectionAsync(string employeeId, DateOnly workDate, DateTime checkIn, DateTime checkOut, CancellationToken ct)
    {
        var shift = await ShiftForAsync(employeeId, workDate, ct);
        var ev = await EvaluateAsync(shift, checkIn, checkOut, ct);
        var rec = await LockDayAsync(employeeId, workDate, ct);
        if (rec is null) { rec = new AttendanceRecord { EmployeeId = employeeId, WorkDate = workDate, WorkMode = "OFFICE" }; db.AttendanceRecords.Add(rec); }
        rec.CheckIn = checkIn; rec.CheckOut = checkOut; rec.WorkedMinutes = ev.Worked; rec.LateMinutes = ev.Late; rec.EarlyDepartureMinutes = ev.Early; rec.OvertimeMinutes = ev.Overtime;
        rec.Status = ev.Status; rec.Source = "CORRECTION"; rec.ShiftId = shift.Id;
        return rec;
    }

    public Task EvictSummaryAsync(string employeeId) => cache.EvictPrefixAsync($"att:summary:{employeeId}");
}

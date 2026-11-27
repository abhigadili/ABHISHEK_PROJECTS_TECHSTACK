using HR.AttendanceService.Clients;
using HR.AttendanceService.Data;
using HR.AttendanceService.DTOs;
using HR.AttendanceService.Entities;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Crud;
using HR.Common.Data;
using HR.Common.Messaging;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace HR.AttendanceService.Services;

public sealed class ShiftCrudService(AttendanceDbContext db, IAuditWriter audit, ICacheService cache) : CrudService<Shift, ShiftRequest, ShiftDto>(db, audit, cache)
{
    protected override string Label => "Shift";
    protected override string[] SortFields => ["Name", "Code", "StartTime"];
    protected override string DefaultSort => "Name";
    protected override string[] SearchFields => ["Name", "Code"];

    private static void CheckThresholds(Shift s)
    {
        if (!(s.HalfDayMinutes <= s.FullDayMinutes && s.FullDayMinutes <= s.StandardMinutes))
            throw new Common.Common.ValidationException("Thresholds must satisfy halfDay <= fullDay <= standard minutes");
    }

    protected override async Task BeforeCreateAsync(Shift e, ShiftRequest r, CancellationToken ct)
    {
        if (await db.Shifts.IgnoreQueryFilters().AnyAsync(s => s.Code == e.Code, ct)) throw new ConflictException("Shift code already exists");
        CheckThresholds(e);
        if (e.IsDefault) await db.Database.ExecuteSqlRawAsync("UPDATE shifts SET is_default = 0", ct);
    }

    protected override async Task BeforeUpdateAsync(Shift e, ShiftRequest r, CancellationToken ct)
    {
        CheckThresholds(e);
        if (r.IsDefault == true) await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE shifts SET is_default = 0 WHERE id <> {e.Id}", ct);
    }

    protected override async Task BeforeDeleteAsync(Shift e, CancellationToken ct)
    {
        if (e.IsDefault) throw new BusinessRuleException("The default shift cannot be deleted");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (await db.ShiftAssignments.AnyAsync(a => a.ShiftId == e.Id && (a.EffectiveTo == null || a.EffectiveTo >= today), ct)) throw new BusinessRuleException("Shift still has active assignments");
    }
}

public interface IShiftAssignmentService
{
    Task<AssignedDto> AssignAsync(AssignShiftRequest r, CancellationToken ct);
    Task<List<ShiftAssignmentDto>> ForEmployeeAsync(string employeeId, CancellationToken ct);
    Task<SyncResultDto> SyncHolidaysAsync(int year, CancellationToken ct);
}

public sealed class ShiftAssignmentService(AttendanceDbContext db, IHolidayClient holidays, IAuditWriter audit, IUnitOfWork uow) : IShiftAssignmentService
{
    public async Task<AssignedDto> AssignAsync(AssignShiftRequest r, CancellationToken ct)
    {
        if (!await db.Shifts.AnyAsync(s => s.Id == r.ShiftId, ct)) throw new NotFoundException("Shift not found");
        var from = r.EffectiveFrom!.Value;
        await uow.ExecuteAsync(async () =>
        {
            foreach (var emp in r.EmployeeIds.Distinct())
            {
                var toBound = r.EffectiveTo ?? DateOnly.MaxValue;
                var overlapping = await db.ShiftAssignments.Where(a => a.EmployeeId == emp && a.EffectiveFrom <= toBound && (a.EffectiveTo == null || a.EffectiveTo >= from)).ToListAsync(ct);
                foreach (var o in overlapping) o.EffectiveTo = from.AddDays(-1);    // history is preserved: close the old assignment the day before
                db.ShiftAssignments.Add(new ShiftAssignment { EmployeeId = emp, ShiftId = r.ShiftId, EffectiveFrom = from, EffectiveTo = r.EffectiveTo });
            }
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("Shift", r.ShiftId, "ASSIGNED", null, r);
        }, ct);
        return new AssignedDto(r.EmployeeIds.Distinct().Count());
    }

    public async Task<List<ShiftAssignmentDto>> ForEmployeeAsync(string employeeId, CancellationToken ct) =>
        await db.ShiftAssignments.AsNoTracking().Where(a => a.EmployeeId == employeeId).OrderByDescending(a => a.EffectiveFrom)
            .Select(a => new ShiftAssignmentDto(a.Id, a.EmployeeId, a.ShiftId, a.EffectiveFrom, a.EffectiveTo)).ToListAsync(ct);

    /// <summary>Pulls holidays from the Holiday Service (HTTP) into the local holiday_snapshots used by the summary stored procedure.</summary>
    public async Task<SyncResultDto> SyncHolidaysAsync(int year, CancellationToken ct)
    {
        var items = await holidays.ForYearAsync(year, ct);
        var n = 0;
        foreach (var h in items.Where(h => h.Type == "MANDATORY"))
        {
            var locations = h.LocationIds.Count > 0 ? h.LocationIds.Select(l => (string?)l).ToList() : [null];
            foreach (var loc in locations)
            {
                var id = loc is null ? h.Id : $"{h.Id}:{loc}"[..36];
                var row = await db.HolidaySnapshots.FirstOrDefaultAsync(s => s.HolidayId == id, ct);
                if (row is null) { row = new HolidaySnapshot { HolidayId = id }; db.HolidaySnapshots.Add(row); }
                row.HolidayDate = h.HolidayDate; row.LocationId = loc; row.Name = h.Name;
                n++;
            }
        }
        await db.SaveChangesAsync(ct);
        return new SyncResultDto(year, n);
    }
}

/// <summary>Leave approved/cancelled events feed approved_leave_days (used by check-in rules and the monthly summary procedure).</summary>
public sealed class LeaveApprovedHandler(AttendanceDbContext db) : EventHandlerBase<LeaveEvent>
{
    public override string Topic => Topics.LeaveApproved;
    protected override async Task HandleAsync(LeaveEvent e, CancellationToken ct)
    {
        var existing = await db.ApprovedLeaveDays.Where(d => d.ApplicationId == e.LeaveId).ToListAsync(ct);
        db.ApprovedLeaveDays.RemoveRange(existing);
        for (var d = e.FromDate; d <= e.ToDate; d = d.AddDays(1)) db.ApprovedLeaveDays.Add(new ApprovedLeaveDay { ApplicationId = e.LeaveId, EmployeeId = e.EmployeeId, LeaveDate = d });
        await db.SaveChangesAsync(ct);
    }
}

public sealed class LeaveCancelledHandler(AttendanceDbContext db) : EventHandlerBase<LeaveEvent>
{
    public override string Topic => Topics.LeaveCancelled;
    protected override async Task HandleAsync(LeaveEvent e, CancellationToken ct)
    {
        db.ApprovedLeaveDays.RemoveRange(await db.ApprovedLeaveDays.Where(d => d.ApplicationId == e.LeaveId).ToListAsync(ct));
        await db.SaveChangesAsync(ct);
    }
}

public sealed class AttendanceEmployeeReadModel(AttendanceDbContext db) : IEmployeeReadModel
{
    public async Task UpsertAsync(EmployeeEvent e, CancellationToken ct)
    {
        var row = await db.AttendanceEmployees.FirstOrDefaultAsync(x => x.EmployeeId == e.EmployeeId, ct);
        if (row is null) { row = new AttendanceEmployee { EmployeeId = e.EmployeeId }; db.AttendanceEmployees.Add(row); }
        row.DepartmentId = e.DepartmentId; row.FullName = e.FullName; row.JoiningDate = e.JoiningDate; row.LocationId = e.LocationId; row.ManagerId = e.ManagerId; row.Status = e.Status;
        await db.SaveChangesAsync(ct);
    }
}

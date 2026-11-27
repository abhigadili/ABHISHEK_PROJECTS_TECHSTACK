using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.HolidayService.Data;
using HR.HolidayService.DTOs;
using HR.HolidayService.Entities;
using Microsoft.EntityFrameworkCore;

namespace HR.HolidayService.Services;

public interface IHolidayService
{
    Task<List<HolidayDto>> ListAsync(HolidayQuery q, CancellationToken ct);
    Task<CalendarDto> CalendarAsync(HolidayQuery q, CancellationToken ct);
    Task<List<HolidayDto>> UpcomingAsync(UpcomingQuery q, CancellationToken ct);
    Task<HolidayCountDto> CountAsync(CountQuery q, CancellationToken ct);
    Task<HolidayDto> GetAsync(string id, CancellationToken ct);
    Task<HolidayDto> CreateAsync(HolidayRequest r, CancellationToken ct);
    Task<HolidayDto> UpdateAsync(string id, HolidayUpdateRequest r, CancellationToken ct);
    Task DeleteAsync(string id, CancellationToken ct);
    Task<List<HolidayYearDto>> ListYearsAsync(CancellationToken ct);
    Task<HolidayYearDto> CreateYearAsync(HolidayYearRequest r, CancellationToken ct);
    Task<HolidayYearDto> UpdateYearAsync(string id, HolidayYearUpdateRequest r, CancellationToken ct);
}

public sealed class HolidayService(HolidayDbContext db, ICacheService cache, IAuditWriter audit, IUnitOfWork uow) : IHolidayService
{
    private static HolidayYearDto ToDto(HolidayYear y) => new(y.Id, y.YearNumber, y.StartDate, y.EndDate, y.Description, y.Active);

    /// <summary>Unscoped holidays apply to everybody; scoped holidays apply when the location or department matches.</summary>
    private IQueryable<Holiday> Applicable(HolidayQuery f)
    {
        var q = db.Holidays.AsNoTracking().AsQueryable();
        if (f.Year is { } y) q = q.Where(h => h.HolidayYear == y);
        if (f.From is { } from) q = q.Where(h => h.HolidayDate >= from);
        if (f.To is { } to) q = q.Where(h => h.HolidayDate <= to);
        if (!string.IsNullOrEmpty(f.Type)) q = q.Where(h => h.Type == f.Type);
        var loc = f.LocationId ?? ""; var dep = f.DepartmentId ?? "";
        return q.Where(h => !db.HolidayScopes.Any(s => s.HolidayId == h.Id)
                            || db.HolidayScopes.Any(s => s.HolidayId == h.Id && ((s.ScopeType == "LOCATION" && s.ScopeId == loc) || (s.ScopeType == "DEPARTMENT" && s.ScopeId == dep))))
                .OrderBy(h => h.HolidayDate).ThenBy(h => h.Name);
    }

    private async Task<List<HolidayDto>> WithScopesAsync(List<Holiday> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var scopes = ids.Count == 0 ? [] : await db.HolidayScopes.AsNoTracking().Where(s => ids.Contains(s.HolidayId)).ToListAsync(ct);
        var byHoliday = scopes.ToLookup(s => s.HolidayId);   // ToLookup: group scopes once, O(1) per holiday
        return rows.Select(h => new HolidayDto(h.Id, h.Name, h.HolidayDate, h.HolidayYear, h.Type, h.Description,
            byHoliday[h.Id].Where(s => s.ScopeType == "LOCATION").Select(s => s.ScopeId).ToList(),
            byHoliday[h.Id].Where(s => s.ScopeType == "DEPARTMENT").Select(s => s.ScopeId).ToList())).ToList();
    }

    public async Task<List<HolidayDto>> ListAsync(HolidayQuery f, CancellationToken ct)
    {
        var hash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(f)))).ToLowerInvariant();
        return (await cache.GetOrCreateAsync($"{CacheKeys.HolidayPrefix}list:{hash}", async c => await WithScopesAsync(await Applicable(f).Take(500).ToListAsync(c), c), CacheKeys.Long, ct))!;
    }

    public async Task<CalendarDto> CalendarAsync(HolidayQuery f, CancellationToken ct)
    {
        var year = f.Year ?? DateTime.UtcNow.Year;
        f.Year = year;
        var items = await ListAsync(f, ct);
        var months = items.GroupBy(h => h.HolidayDate.ToString("yyyy-MM")).OrderBy(g => g.Key).Select(g => new MonthDto(g.Key, g.ToList())).ToList();
        return new CalendarDto(year, months, items.Count);
    }

    public async Task<List<HolidayDto>> UpcomingAsync(UpcomingQuery q, CancellationToken ct)
    {
        var from = DateOnly.FromDateTime(DateTime.UtcNow);
        var items = await ListAsync(new HolidayQuery { From = from, To = from.AddDays(365), LocationId = q.LocationId, DepartmentId = q.DepartmentId }, ct);
        return items.Take(q.Limit).ToList();
    }

    /// <summary>Mandatory holidays between two dates (weekends excluded) - used by leave and attendance calculations.</summary>
    public async Task<HolidayCountDto> CountAsync(CountQuery q, CancellationToken ct)
    {
        var rows = await Applicable(new HolidayQuery { From = q.From, To = q.To, LocationId = q.LocationId, DepartmentId = q.DepartmentId, Type = "MANDATORY" }).ToListAsync(ct);
        var dates = rows.Select(r => r.HolidayDate).Distinct().Where(d => d.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)).OrderBy(d => d).ToList();
        return new HolidayCountDto(q.From!.Value, q.To!.Value, dates.Count, dates);
    }

    public async Task<HolidayDto> GetAsync(string id, CancellationToken ct)
    {
        var h = await db.Holidays.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Holiday not found");
        return (await WithScopesAsync([h], ct))[0];
    }

    private async Task<int> ValidateAsync(DateOnly date, string name, string? excludeId, CancellationToken ct)
    {
        var year = await db.HolidayYears.AsNoTracking().Where(y => y.Active && y.StartDate <= date && y.EndDate >= date).OrderByDescending(y => y.YearNumber).FirstOrDefaultAsync(ct)
                   ?? throw new BusinessRuleException($"No active holiday year configured for {date:yyyy-MM-dd}");
        if (await db.Holidays.AnyAsync(h => h.HolidayDate == date && h.Name == name && h.Id != excludeId, ct)) throw new ConflictException("A holiday with this name already exists on that date");
        return year.YearNumber;
    }

    // holiday_scopes has no primary key in the existing (Java) schema, so scope rows are written with parameterised raw SQL
    private async Task SetScopesAsync(string holidayId, IEnumerable<string> locationIds, IEnumerable<string> departmentIds, CancellationToken ct)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM holiday_scopes WHERE holiday_id = {holidayId}", ct);
        foreach (var l in locationIds.Distinct()) await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO holiday_scopes (holiday_id, scope_id, scope_type) VALUES ({holidayId}, {l}, 'LOCATION')", ct);
        foreach (var d in departmentIds.Distinct()) await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO holiday_scopes (holiday_id, scope_id, scope_type) VALUES ({holidayId}, {d}, 'DEPARTMENT')", ct);
    }

    public async Task<HolidayDto> CreateAsync(HolidayRequest r, CancellationToken ct)
    {
        var yearNo = await ValidateAsync(r.Date!.Value, r.Name, null, ct);
        var h = new Holiday { Name = r.Name, HolidayDate = r.Date.Value, HolidayYear = yearNo, Type = r.Type, Description = r.Description };
        await uow.ExecuteAsync(async () =>
        {
            db.Holidays.Add(h);
            await db.SaveChangesAsync(ct);
            await SetScopesAsync(h.Id, r.LocationIds, r.DepartmentIds, ct);
            await audit.WriteAsync("Holiday", h.Id, "CREATED", null, r);
        }, ct);
        await cache.EvictPrefixAsync(CacheKeys.HolidayPrefix);
        return await GetAsync(h.Id, ct);
    }

    public async Task<HolidayDto> UpdateAsync(string id, HolidayUpdateRequest r, CancellationToken ct)
    {
        var h = await db.Holidays.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Holiday not found");
        var before = await GetAsync(id, ct);
        var date = r.Date ?? h.HolidayDate; var name = r.Name ?? h.Name;
        var yearNo = await ValidateAsync(date, name, id, ct);
        h.Name = name; h.HolidayDate = date; h.HolidayYear = yearNo; h.Type = r.Type ?? h.Type; h.Description = r.Description ?? h.Description;
        await uow.ExecuteAsync(async () =>
        {
            await db.SaveChangesAsync(ct);
            if (r.LocationIds is not null || r.DepartmentIds is not null) await SetScopesAsync(id, r.LocationIds ?? before.LocationIds, r.DepartmentIds ?? before.DepartmentIds, ct);
            await audit.WriteAsync("Holiday", id, "UPDATED", before, r);
        }, ct);
        await cache.EvictPrefixAsync(CacheKeys.HolidayPrefix);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct)
    {
        var h = await db.Holidays.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Holiday not found");
        h.Deleted = true; h.DeletedAt = DateTime.UtcNow;
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("Holiday", id, "DELETED"); }, ct);
        await cache.EvictPrefixAsync(CacheKeys.HolidayPrefix);
    }

    public async Task<List<HolidayYearDto>> ListYearsAsync(CancellationToken ct) =>
        (await db.HolidayYears.AsNoTracking().OrderByDescending(y => y.YearNumber).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<HolidayYearDto> CreateYearAsync(HolidayYearRequest r, CancellationToken ct)
    {
        if (await db.HolidayYears.AnyAsync(y => y.YearNumber == r.YearNumber, ct)) throw new ConflictException("Holiday year already exists");
        var y = new HolidayYear { YearNumber = r.YearNumber!.Value, StartDate = r.StartDate!.Value, EndDate = r.EndDate!.Value, Description = r.Description, Active = r.Active ?? true };
        db.HolidayYears.Add(y);
        await db.SaveChangesAsync(ct);
        await cache.EvictPrefixAsync(CacheKeys.HolidayPrefix);
        return ToDto(y);
    }

    public async Task<HolidayYearDto> UpdateYearAsync(string id, HolidayYearUpdateRequest r, CancellationToken ct)
    {
        var y = await db.HolidayYears.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Holiday year not found");
        var start = r.StartDate ?? y.StartDate; var end = r.EndDate ?? y.EndDate;
        if (end < start) throw new Common.Common.ValidationException("endDate must not precede startDate");
        y.StartDate = start; y.EndDate = end; y.Description = r.Description ?? y.Description; if (r.Active is { } a) y.Active = a;
        await db.SaveChangesAsync(ct);
        await cache.EvictPrefixAsync(CacheKeys.HolidayPrefix);
        return ToDto(y);
    }
}

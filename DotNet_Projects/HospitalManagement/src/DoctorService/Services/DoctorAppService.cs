using HMS.Doctors.Clients;
using HMS.Doctors.Data;
using HMS.Doctors.Domain;
using HMS.Doctors.Dtos;
using HMS.Shared.Cache;
using HMS.Shared.Common;
using HMS.Shared.Data;
using Microsoft.EntityFrameworkCore;

namespace HMS.Doctors.Services;

public interface IDoctorAppService
{
    Task<DoctorResponse> CreateAsync(DoctorRequest r, CancellationToken ct);
    Task<DoctorResponse> GetAsync(long id, CancellationToken ct);
    Task<DoctorResponse> UpdateAsync(long id, DoctorRequest r, CancellationToken ct);
    Task DeactivateAsync(long id, CancellationToken ct);
    Task<PageResponse<DoctorResponse>> SearchAsync(string? specialization, long? hospitalId, long? departmentId, bool? active, int page, int size, CancellationToken ct);
    Task<List<string>> SpecializationsAsync(CancellationToken ct);
    Task<List<AvailableDoctor>> AvailableOnAsync(DateOnly date, string? specialization, CancellationToken ct);
    Task<List<SlotDto>> SlotsAsync(long doctorId, DateOnly date, CancellationToken ct);
    Task<List<ScheduleEntry>> ScheduleAsync(long doctorId, CancellationToken ct);
    Task<List<ScheduleEntry>> ReplaceScheduleAsync(long doctorId, ScheduleRequest req, CancellationToken ct);
    Task<List<UnavailabilityResponse>> UnavailabilityAsync(long doctorId, CancellationToken ct);
    Task<UnavailabilityResponse> AddUnavailabilityAsync(long doctorId, UnavailabilityRequest req, CancellationToken ct);
    Task RemoveUnavailabilityAsync(long doctorId, long unavailabilityId, CancellationToken ct);
}

public sealed class DoctorAppService(DoctorDbContext db, IRepository<Doctor> doctors, IHospitalDirectory hospitals, ICacheService cache, ICurrentUser user,
    IConfiguration cfg, ILogger<DoctorAppService> log) : IDoctorAppService
{
    private TimeSpan DoctorTtl => TimeSpan.FromMinutes(cfg.GetValue("Cache:DoctorMinutes", 15));
    private TimeSpan SlotTtl => TimeSpan.FromMinutes(cfg.GetValue("Cache:SlotMinutes", 5));
    private static string DKey(long id) => $"doctor:{id}";
    private static string VersionKey(long id) => $"doctor-slots-version:{id}";

    public async Task<DoctorResponse> CreateAsync(DoctorRequest r, CancellationToken ct)
    {
        if (await doctors.AnyAsync(d => d.LicenseNumber == r.LicenseNumber, ct)) throw new ConflictException($"License number '{r.LicenseNumber}' is already registered");
        if (await doctors.AnyAsync(d => d.Email == r.Email.ToLower(), ct)) throw new ConflictException($"Email '{r.Email}' is already registered");
        if (r.UserId is not null && await doctors.AnyAsync(d => d.UserId == r.UserId, ct)) throw new ConflictException("This login already belongs to another doctor");
        await hospitals.ValidateAsync(r.HospitalId!.Value, r.DepartmentId, ct);     // HttpClient + Polly
        var d = new Doctor { UserId = r.UserId };
        Apply(d, r);
        await doctors.AddAsync(d, ct);
        try { await doctors.SaveAsync(ct); }
        catch (DbUpdateException) { throw new ConflictException("Duplicate doctor (license, email or login)"); }
        log.LogInformation("Created doctor {DoctorId}", d.Id);
        return DoctorResponse.From(d);
    }

    public async Task<DoctorResponse> GetAsync(long id, CancellationToken ct) =>
        await cache.GetOrCreateAsync(DKey(id), async t => (await doctors.Query().AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, t)) is { } d ? DoctorResponse.From(d) : null, DoctorTtl, ct)
        ?? throw new NotFoundException($"Doctor {id} not found");

    public async Task<DoctorResponse> UpdateAsync(long id, DoctorRequest r, CancellationToken ct)
    {
        var d = await doctors.GetAsync(id, ct) ?? throw new NotFoundException($"Doctor {id} not found");
        if (d.LicenseNumber != r.LicenseNumber && await doctors.AnyAsync(x => x.LicenseNumber == r.LicenseNumber, ct)) throw new ConflictException("License number already registered");
        if (d.Email != r.Email.ToLower() && await doctors.AnyAsync(x => x.Email == r.Email.ToLower(), ct)) throw new ConflictException("Email already registered");
        if (r.UserId is not null && r.UserId != d.UserId)
        {
            if (await doctors.AnyAsync(x => x.UserId == r.UserId, ct)) throw new ConflictException("This login already belongs to another doctor");
            d.UserId = r.UserId;
        }
        await hospitals.ValidateAsync(r.HospitalId!.Value, r.DepartmentId, ct);
        Apply(d, r);
        await doctors.SaveAsync(ct);
        var dto = DoctorResponse.From(d);
        await cache.SetAsync(DKey(id), dto, DoctorTtl, ct);       // cache update
        return dto;
    }

    public async Task DeactivateAsync(long id, CancellationToken ct)
    {
        var d = await doctors.GetAsync(id, ct) ?? throw new NotFoundException($"Doctor {id} not found");
        d.Active = false;
        await doctors.SaveAsync(ct);
        await cache.RemoveAsync(DKey(id), ct);
        await BumpSlotVersionAsync(id, ct);
    }

    public async Task<PageResponse<DoctorResponse>> SearchAsync(string? specialization, long? hospitalId, long? departmentId, bool? active, int page, int size, CancellationToken ct)
    {
        size = Math.Clamp(size, 1, 100);
        var q = doctors.Query().AsNoTracking().Where(d => d.Active == (active ?? true));
        if (!string.IsNullOrWhiteSpace(specialization)) { var s = specialization.Trim().ToLower(); q = q.Where(d => d.Specialization.ToLower() == s); }
        if (hospitalId is not null) q = q.Where(d => d.HospitalId == hospitalId);
        if (departmentId is not null) q = q.Where(d => d.DepartmentId == departmentId);
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderBy(d => d.LastName).ThenBy(d => d.FirstName).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<DoctorResponse>(rows.Select(DoctorResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public Task<List<string>> SpecializationsAsync(CancellationToken ct) =>
        doctors.Query().Where(d => d.Active).Select(d => d.Specialization).Distinct().OrderBy(s => s).ToListAsync(ct);

    /// <summary>Scenario 2: doctors who work that weekday and have not marked the date as a day off, with their slot counts.</summary>
    public async Task<List<AvailableDoctor>> AvailableOnAsync(DateOnly date, string? specialization, CancellationToken ct)
    {
        var q = doctors.Query().AsNoTracking().Where(d => d.Active
            && db.Schedules.Any(s => s.DoctorId == d.Id && s.DayOfWeek == date.DayOfWeek)
            && !db.Unavailability.Any(u => u.DoctorId == d.Id && u.UnavailableDate == date));
        if (!string.IsNullOrWhiteSpace(specialization)) { var s = specialization.Trim().ToLower(); q = q.Where(d => d.Specialization.ToLower() == s); }
        var list = await q.OrderBy(d => d.LastName).ThenBy(d => d.FirstName).ToListAsync(ct);
        var result = new List<AvailableDoctor>();
        foreach (var d in list)
        {
            var slots = await SlotsAsync(d.Id, date, ct);   // cached
            if (slots.Count > 0) result.Add(new AvailableDoctor(DoctorResponse.From(d), slots.Count, slots[0].StartTime, slots[^1].EndTime));
        }
        return result;
    }

    /// <summary>Slot grid from the weekly template minus the break; empty on days off / inactive doctors. Cached per doctor+date, versioned per doctor for O(1) invalidation.</summary>
    public async Task<List<SlotDto>> SlotsAsync(long doctorId, DateOnly date, CancellationToken ct)
    {
        if (!await doctors.AnyAsync(d => d.Id == doctorId, ct)) throw new NotFoundException($"Doctor {doctorId} not found");
        var version = (await cache.GetOrCreateAsync(VersionKey(doctorId), _ => Task.FromResult<string?>(Guid.NewGuid().ToString("N")), TimeSpan.FromDays(1), ct)) ?? "0";
        var key = $"doctor-slots:{doctorId}:{version}:{date:yyyy-MM-dd}";
        return await cache.GetOrCreateAsync(key, t => BuildSlotsAsync(doctorId, date, t), SlotTtl, ct) ?? [];
    }

    private async Task<List<SlotDto>?> BuildSlotsAsync(long doctorId, DateOnly date, CancellationToken ct)
    {
        var slots = new List<SlotDto>();
        var doctor = await doctors.Query().AsNoTracking().FirstAsync(d => d.Id == doctorId, ct);
        if (!doctor.Active || await db.Unavailability.AnyAsync(u => u.DoctorId == doctorId && u.UnavailableDate == date, ct)) return slots;
        var s = await db.Schedules.AsNoTracking().FirstOrDefaultAsync(x => x.DoctorId == doctorId && x.DayOfWeek == date.DayOfWeek, ct);
        if (s is null) return slots;
        var start = s.StartTime;
        while (start.AddMinutes(s.SlotMinutes) > start && start.AddMinutes(s.SlotMinutes) <= s.EndTime)
        {
            var end = start.AddMinutes(s.SlotMinutes);
            var inBreak = s.BreakStart is not null && s.BreakEnd is not null && start < s.BreakEnd && end > s.BreakStart;
            if (!inBreak) slots.Add(new SlotDto(start, end));
            start = end;
        }
        return slots;
    }

    public async Task<List<ScheduleEntry>> ScheduleAsync(long doctorId, CancellationToken ct)
    {
        if (!await doctors.AnyAsync(d => d.Id == doctorId, ct)) throw new NotFoundException($"Doctor {doctorId} not found");
        return (await db.Schedules.AsNoTracking().Where(s => s.DoctorId == doctorId).OrderBy(s => s.DayOfWeek).ToListAsync(ct)).Select(ScheduleEntry.From).ToList();
    }

    /// <summary>Scenario 3: replaces the weekly template (working days, slot length, breaks).</summary>
    public async Task<List<ScheduleEntry>> ReplaceScheduleAsync(long doctorId, ScheduleRequest req, CancellationToken ct)
    {
        var d = await doctors.GetAsync(doctorId, ct) ?? throw new NotFoundException($"Doctor {doctorId} not found");
        AssertCanManage(d);
        var seen = new HashSet<DayOfWeek>();
        foreach (var e in req.Days)
        {
            if (!seen.Add(e.DayOfWeek!.Value)) throw new BadRequestException($"Duplicate entry for {e.DayOfWeek}");
            Validate(e);
        }
        await db.InTransactionAsync(async () =>
        {
            db.Schedules.RemoveRange(await db.Schedules.Where(s => s.DoctorId == doctorId).ToListAsync(ct));
            await db.SaveChangesAsync(ct);
            foreach (var e in req.Days)
                db.Schedules.Add(new DoctorSchedule { DoctorId = doctorId, DayOfWeek = e.DayOfWeek!.Value, StartTime = e.StartTime!.Value, EndTime = e.EndTime!.Value, SlotMinutes = e.SlotMinutes!.Value, BreakStart = e.BreakStart, BreakEnd = e.BreakEnd });
            await db.SaveChangesAsync(ct);
        }, ct);
        await BumpSlotVersionAsync(doctorId, ct);       // evict every cached slot grid of this doctor
        log.LogInformation("Schedule of doctor {DoctorId} replaced ({Days} working days)", doctorId, req.Days.Count);
        return await ScheduleAsync(doctorId, ct);
    }

    public async Task<List<UnavailabilityResponse>> UnavailabilityAsync(long doctorId, CancellationToken ct)
    {
        if (!await doctors.AnyAsync(d => d.Id == doctorId, ct)) throw new NotFoundException($"Doctor {doctorId} not found");
        var today = DateOnly.FromDateTime(DateTime.Now);
        return await db.Unavailability.AsNoTracking().Where(u => u.DoctorId == doctorId && u.UnavailableDate >= today).OrderBy(u => u.UnavailableDate)
            .Select(u => new UnavailabilityResponse(u.Id, u.UnavailableDate, u.Reason)).ToListAsync(ct);
    }

    public async Task<UnavailabilityResponse> AddUnavailabilityAsync(long doctorId, UnavailabilityRequest req, CancellationToken ct)
    {
        var d = await doctors.GetAsync(doctorId, ct) ?? throw new NotFoundException($"Doctor {doctorId} not found");
        AssertCanManage(d);
        if (req.Date!.Value < DateOnly.FromDateTime(DateTime.Now)) throw new BadRequestException("Cannot mark a past date as unavailable");
        if (await db.Unavailability.AnyAsync(u => u.DoctorId == doctorId && u.UnavailableDate == req.Date, ct)) throw new ConflictException($"Date {req.Date} is already marked unavailable");
        var u = new DoctorUnavailability { DoctorId = doctorId, UnavailableDate = req.Date.Value, Reason = req.Reason };
        db.Unavailability.Add(u);
        await db.SaveChangesAsync(ct);
        await BumpSlotVersionAsync(doctorId, ct);
        return new UnavailabilityResponse(u.Id, u.UnavailableDate, u.Reason);
    }

    public async Task RemoveUnavailabilityAsync(long doctorId, long unavailabilityId, CancellationToken ct)
    {
        var d = await doctors.GetAsync(doctorId, ct) ?? throw new NotFoundException($"Doctor {doctorId} not found");
        AssertCanManage(d);
        var u = await db.Unavailability.FirstOrDefaultAsync(x => x.Id == unavailabilityId && x.DoctorId == doctorId, ct) ?? throw new NotFoundException($"Unavailability {unavailabilityId} not found");
        db.Unavailability.Remove(u);
        await db.SaveChangesAsync(ct);
        await BumpSlotVersionAsync(doctorId, ct);
    }

    private Task BumpSlotVersionAsync(long doctorId, CancellationToken ct) =>
        cache.SetAsync(VersionKey(doctorId), Guid.NewGuid().ToString("N"), TimeSpan.FromDays(1), ct);

    private static void Validate(ScheduleEntry e)
    {
        var day = e.DayOfWeek;
        if (e.StartTime >= e.EndTime) throw new BadRequestException($"{day}: startTime must be before endTime");
        if ((e.BreakStart is null) != (e.BreakEnd is null)) throw new BadRequestException($"{day}: breakStart and breakEnd must be given together");
        if (e.BreakStart is not null && (e.BreakStart >= e.BreakEnd || e.BreakStart < e.StartTime || e.BreakEnd > e.EndTime))
            throw new BadRequestException($"{day}: break must lie inside working hours and start before it ends");
        if ((e.EndTime!.Value - e.StartTime!.Value).TotalMinutes < e.SlotMinutes) throw new BadRequestException($"{day}: working hours are shorter than one slot");
    }

    /// <summary>Admin/hospital staff may manage anyone's availability; a doctor only their own.</summary>
    private void AssertCanManage(Doctor d)
    {
        if (user.IsAdmin) return;
        if (user.IsInRole(Roles.Doctor) && d.UserId is not null && d.UserId == user.Id) return;
        throw new ForbiddenException("Only an administrator or the doctor concerned can change this availability");
    }

    private static void Apply(Doctor d, DoctorRequest r)
    {
        d.FirstName = r.FirstName.Trim();
        d.LastName = r.LastName.Trim();
        d.Email = r.Email.Trim().ToLowerInvariant();
        d.Phone = r.Phone;
        d.LicenseNumber = r.LicenseNumber.Trim();
        d.Specialization = r.Specialization.Trim();
        d.Qualification = r.Qualification;
        d.ExperienceYears = r.ExperienceYears;
        d.ConsultationFee = r.ConsultationFee!.Value;
        d.HospitalId = r.HospitalId!.Value;
        d.DepartmentId = r.DepartmentId;
    }
}

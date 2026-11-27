using Common.Caching;
using Common.Errors;
using Common.Paging;
using CourseService.Dtos;
using CourseService.Entities;
using CourseService.Repositories;

namespace CourseService.Services;

public interface ICourseAppService
{
    Task<CourseResponse> CreateAsync(CourseRequest r, CancellationToken ct = default);
    Task<CourseResponse> GetAsync(long id, CancellationToken ct = default);
    Task<CourseAvailabilityResponse> AvailabilityAsync(long id, CancellationToken ct = default);
    Task<PagedResult<CourseResponse>> SearchAsync(string? search, long? categoryId, CourseStatus? status, decimal? minFees, decimal? maxFees, bool availableOnly, PageRequest page, CancellationToken ct = default);
    Task<CourseResponse> UpdateAsync(long id, CourseRequest r, CancellationToken ct = default);
    Task<CourseResponse> UpdateStatusAsync(long id, CourseStatus status, CancellationToken ct = default);
    Task DeleteAsync(long id, CancellationToken ct = default);
}

/// <summary>Course CRUD and cached reads. "course:{id}" (10 min) and "course-availability:{id}" (1 min) are evicted after every change.</summary>
public class CourseAppService(ICourseRepository repo, ICategoryRepository categories, ICacheService cache, ILogger<CourseAppService> log) : ICourseAppService
{
    public static readonly TimeSpan CourseTtl = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan AvailabilityTtl = TimeSpan.FromMinutes(1);
    public static string CourseKey(long id) => $"course:{id}";
    public static string AvailabilityKey(long id) => $"course-availability:{id}";

    public async Task<CourseResponse> CreateAsync(CourseRequest r, CancellationToken ct = default)
    {
        if (await repo.CodeExistsAsync(r.CourseCode, null, ct)) throw new ConflictException($"Course code '{r.CourseCode}' already exists");
        await RequireCategory(r.CategoryId, ct);
        var c = new Course { TotalSeats = r.TotalSeats!.Value, AvailableSeats = r.TotalSeats.Value };   // all seats free at creation
        Apply(r, c);
        await repo.AddAsync(c, ct);
        await repo.SaveAsync(ct);
        log.LogInformation("Created course id={CourseId} code={Code}", c.CourseId, c.CourseCode);
        return ToResponse((await repo.FindReadOnlyAsync(c.CourseId, ct))!);
    }

    public async Task<CourseResponse> GetAsync(long id, CancellationToken ct = default)
        => await cache.GetOrSetAsync(CourseKey(id), CourseTtl, async () => (await repo.FindReadOnlyAsync(id, ct)) is { } c ? ToResponse(c) : null, ct)
           ?? throw new NotFoundException($"Course {id} not found");

    public async Task<CourseAvailabilityResponse> AvailabilityAsync(long id, CancellationToken ct = default)
        => await cache.GetOrSetAsync(AvailabilityKey(id), AvailabilityTtl, async () => (await repo.FindReadOnlyAsync(id, ct)) is { } c ? ToAvailability(c) : null, ct)
           ?? throw new NotFoundException($"Course {id} not found");

    public async Task<PagedResult<CourseResponse>> SearchAsync(string? search, long? categoryId, CourseStatus? status, decimal? minFees, decimal? maxFees, bool availableOnly, PageRequest page, CancellationToken ct = default)
    {
        var p = await repo.SearchAsync(search, categoryId, status, minFees, maxFees, availableOnly, page, ct);
        return new PagedResult<CourseResponse>(p.Content.Select(ToResponse).ToList(), p.Page, p.Size, p.TotalElements, p.TotalPages);
    }

    public async Task<CourseResponse> UpdateAsync(long id, CourseRequest r, CancellationToken ct = default)
    {
        var c = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Course {id} not found");
        if (await repo.CodeExistsAsync(r.CourseCode, id, ct)) throw new ConflictException($"Course code '{r.CourseCode}' already exists");
        await RequireCategory(r.CategoryId, ct);
        var oldTotal = c.TotalSeats;
        Apply(r, c);
        c.Version++;                                   // concurrency token: a concurrent writer makes this save fail (409)
        await repo.SaveAsync(ct);
        if (r.TotalSeats!.Value != oldTotal && await repo.ChangeCapacityAsync(id, r.TotalSeats.Value, ct) == 0)
            throw new BusinessRuleException($"totalSeats {r.TotalSeats} is below the number of seats already reserved");
        await Evict(id, ct);
        return ToResponse((await repo.FindReadOnlyAsync(id, ct))!);
    }

    public async Task<CourseResponse> UpdateStatusAsync(long id, CourseStatus status, CancellationToken ct = default)
    {
        var c = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Course {id} not found");
        c.Status = status;
        c.Version++;
        await repo.SaveAsync(ct);
        await Evict(id, ct);
        return ToResponse((await repo.FindReadOnlyAsync(id, ct))!);
    }

    public async Task DeleteAsync(long id, CancellationToken ct = default)
    {
        var c = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Course {id} not found");
        repo.Remove(c);
        await repo.SaveAsync(ct);          // FK from seat reservations → 409 if the course ever had reservations
        await Evict(id, ct);
        log.LogInformation("Deleted course id={CourseId}", id);
    }

    private async Task Evict(long id, CancellationToken ct) { await cache.RemoveAsync(CourseKey(id), ct); await cache.RemoveAsync(AvailabilityKey(id), ct); }

    private async Task RequireCategory(long? id, CancellationToken ct)
    {
        if (id != null && await categories.FindAsync(id.Value, ct) is null) throw new BusinessRuleException($"Category {id} does not exist");
    }

    private static void Apply(CourseRequest r, Course c)
    {
        c.CourseName = r.CourseName.Trim();
        c.CourseCode = r.CourseCode.Trim();
        c.Description = r.Description;
        c.CategoryId = r.CategoryId;
        c.DurationWeeks = r.DurationWeeks!.Value;
        c.Fees = r.Fees!.Value;
        if (r.Status != null) c.Status = r.Status.Value;
    }

    public static CourseResponse ToResponse(Course c) => new(c.CourseId, c.CourseName, c.CourseCode, c.Description, c.CategoryId, c.Category?.Name,
        c.DurationWeeks, c.Fees, c.TotalSeats, c.AvailableSeats, c.Status, c.CreatedAt, c.UpdatedAt);
    public static CourseAvailabilityResponse ToAvailability(Course c) => new(c.CourseId, c.Status, c.TotalSeats, c.AvailableSeats, c.Status == CourseStatus.Active && c.AvailableSeats > 0);
}

using Common.Caching;
using Common.Errors;
using Common.Paging;
using StudentService.Dtos;
using StudentService.Entities;
using StudentService.Repositories;

namespace StudentService.Services;

public interface IStudentAppService
{
    Task<StudentResponse> CreateAsync(StudentRequest r, CancellationToken ct = default);
    Task<StudentResponse> GetAsync(long id, CancellationToken ct = default);
    Task<PagedResult<StudentResponse>> SearchAsync(string? search, StudentStatus? status, Gender? gender, PageRequest page, CancellationToken ct = default);
    Task<StudentResponse> UpdateAsync(long id, StudentRequest r, CancellationToken ct = default);
    Task<StudentResponse> UpdateStatusAsync(long id, StudentStatus status, CancellationToken ct = default);
    Task DeleteAsync(long id, CancellationToken ct = default);
    Task<EligibilityResponse> EligibilityAsync(long id, CancellationToken ct = default);
}

/// <summary>Student business logic. Reads of a single student are cached in Redis (cache-aside, 10 min); every write refreshes or evicts the entry.</summary>
public class StudentAppService(IStudentRepository repo, ICacheService cache, ILogger<StudentAppService> log) : IStudentAppService
{
    public static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);
    public static string CacheKey(long id) => $"student:{id}";

    public async Task<StudentResponse> CreateAsync(StudentRequest r, CancellationToken ct = default)
    {
        if (await repo.EmailExistsAsync(r.Email, null, ct)) throw new ConflictException($"A student with email '{r.Email}' already exists");
        var s = new Student { EnrollmentDate = DateOnly.FromDateTime(DateTime.UtcNow), Status = StudentStatus.Active };
        Apply(r, s);
        await repo.AddAsync(s, ct);
        await repo.SaveAsync(ct);
        log.LogInformation("Created student id={StudentId}", s.StudentId);
        return ToResponse(s);
    }

    public async Task<StudentResponse> GetAsync(long id, CancellationToken ct = default)
        => await cache.GetOrSetAsync(CacheKey(id), CacheTtl, async () =>
        {
            var s = await repo.FindAsync(id, ct);
            return s is null ? null : ToResponse(s);
        }, ct) ?? throw new NotFoundException($"Student {id} not found");

    public async Task<PagedResult<StudentResponse>> SearchAsync(string? search, StudentStatus? status, Gender? gender, PageRequest page, CancellationToken ct = default)
    {
        var p = await repo.SearchAsync(search, status, gender, page, ct);
        return new PagedResult<StudentResponse>(p.Content.Select(ToResponse).ToList(), p.Page, p.Size, p.TotalElements, p.TotalPages);
    }

    public async Task<StudentResponse> UpdateAsync(long id, StudentRequest r, CancellationToken ct = default)
    {
        var s = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Student {id} not found");
        if (await repo.EmailExistsAsync(r.Email, id, ct)) throw new ConflictException($"A student with email '{r.Email}' already exists");
        Apply(r, s);
        s.UpdatedAt = DateTime.UtcNow;
        await repo.SaveAsync(ct);
        var resp = ToResponse(s);
        await cache.SetAsync(CacheKey(id), resp, CacheTtl, ct);     // cache update on change
        return resp;
    }

    public async Task<StudentResponse> UpdateStatusAsync(long id, StudentStatus status, CancellationToken ct = default)
    {
        var s = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Student {id} not found");
        s.Status = status;
        s.UpdatedAt = DateTime.UtcNow;
        await repo.SaveAsync(ct);
        log.LogInformation("Student id={StudentId} status -> {Status}", id, status);
        var resp = ToResponse(s);
        await cache.SetAsync(CacheKey(id), resp, CacheTtl, ct);
        return resp;
    }

    public async Task DeleteAsync(long id, CancellationToken ct = default)
    {
        var s = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Student {id} not found");
        repo.Remove(s);
        await repo.SaveAsync(ct);
        await cache.RemoveAsync(CacheKey(id), ct);                  // cache invalidation
        log.LogInformation("Deleted student id={StudentId}", id);
    }

    /// <summary>Used by Enrollment Service: only Active students may enroll.</summary>
    public async Task<EligibilityResponse> EligibilityAsync(long id, CancellationToken ct = default)
    {
        var s = await GetAsync(id, ct);
        var ok = s.Status == StudentStatus.Active;
        return new EligibilityResponse(id, ok, ok ? null : $"Student is {s.Status}");
    }

    private static void Apply(StudentRequest r, Student s)
    {
        s.FirstName = r.FirstName.Trim();
        s.LastName = r.LastName.Trim();
        s.Email = r.Email.Trim().ToLowerInvariant();
        s.PhoneNumber = r.PhoneNumber;
        s.DateOfBirth = r.DateOfBirth;
        s.Gender = r.Gender;
        s.Address = r.Address;
        if (r.EnrollmentDate != null) s.EnrollmentDate = r.EnrollmentDate.Value;
        if (r.Status != null) s.Status = r.Status.Value;
    }

    public static StudentResponse ToResponse(Student s) => new(s.StudentId, s.FirstName, s.LastName, s.Email, s.PhoneNumber, s.DateOfBirth,
        s.Gender, s.Address, s.EnrollmentDate, s.Status, s.CreatedAt, s.UpdatedAt);
}

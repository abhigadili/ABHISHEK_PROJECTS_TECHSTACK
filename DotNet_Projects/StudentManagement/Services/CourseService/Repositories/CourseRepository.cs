using Common.Paging;
using CourseService.Data;
using CourseService.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseService.Repositories;

public interface ICourseRepository
{
    Task<Course?> FindAsync(long id, CancellationToken ct = default);
    Task<Course?> FindReadOnlyAsync(long id, CancellationToken ct = default);
    Task<bool> CodeExistsAsync(string code, long? exceptId, CancellationToken ct = default);
    Task<bool> CategoryInUseAsync(long categoryId, CancellationToken ct = default);
    Task AddAsync(Course c, CancellationToken ct = default);
    void Remove(Course c);
    Task SaveAsync(CancellationToken ct = default);
    Task<PagedResult<Course>> SearchAsync(string? search, long? categoryId, CourseStatus? status, decimal? minFees, decimal? maxFees, bool availableOnly, PageRequest page, CancellationToken ct = default);
    /// <summary>Atomic conditional decrement; returns rows changed (1 = reserved, 0 = sold out or inactive).</summary>
    Task<int> TryReserveSeatAsync(long courseId, CancellationToken ct = default);
    /// <summary>Atomic conditional increment, never above capacity.</summary>
    Task<int> TryReleaseSeatAsync(long courseId, CancellationToken ct = default);
    /// <summary>Change capacity keeping the number of seats already taken; 0 rows = new capacity below reserved seats.</summary>
    Task<int> ChangeCapacityAsync(long courseId, int total, CancellationToken ct = default);
    Task<SeatReservation?> FindReservationAsync(long enrollmentId, CancellationToken ct = default);
    Task AddReservationAsync(SeatReservation r, CancellationToken ct = default);
}

public class CourseRepository(CourseDbContext db) : ICourseRepository
{
    public Task<Course?> FindAsync(long id, CancellationToken ct = default) => db.Courses.Include(c => c.Category).FirstOrDefaultAsync(c => c.CourseId == id, ct);
    public Task<Course?> FindReadOnlyAsync(long id, CancellationToken ct = default) => db.Courses.AsNoTracking().Include(c => c.Category).FirstOrDefaultAsync(c => c.CourseId == id, ct);
    public Task<bool> CodeExistsAsync(string code, long? exceptId, CancellationToken ct = default)
    {
        var c = code.Trim().ToUpper();
        return db.Courses.AnyAsync(x => x.CourseCode.ToUpper() == c && (exceptId == null || x.CourseId != exceptId), ct);
    }
    public Task<bool> CategoryInUseAsync(long categoryId, CancellationToken ct = default) => db.Courses.AnyAsync(c => c.CategoryId == categoryId, ct);
    public async Task AddAsync(Course c, CancellationToken ct = default) => await db.Courses.AddAsync(c, ct);
    public void Remove(Course c) => db.Courses.Remove(c);
    public Task SaveAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<PagedResult<Course>> SearchAsync(string? search, long? categoryId, CourseStatus? status, decimal? minFees, decimal? maxFees, bool availableOnly, PageRequest page, CancellationToken ct = default)
    {
        IQueryable<Course> q = db.Courses.AsNoTracking().Include(c => c.Category);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var like = search.Trim().ToLower();
            q = q.Where(c => c.CourseName.ToLower().Contains(like) || c.CourseCode.ToLower().Contains(like) || (c.Description != null && c.Description.ToLower().Contains(like)));
        }
        if (categoryId != null) q = q.Where(c => c.CategoryId == categoryId);
        if (status != null) q = q.Where(c => c.Status == status);
        if (minFees != null) q = q.Where(c => c.Fees >= minFees);
        if (maxFees != null) q = q.Where(c => c.Fees <= maxFees);
        if (availableOnly) q = q.Where(c => c.AvailableSeats > 0);
        var total = await q.LongCountAsync(ct);
        var items = await q.OrderByName(page.SortBy, page.Descending).ThenBy(c => c.CourseId).Skip(page.Page * page.Size).Take(page.Size).ToListAsync(ct);
        return new PagedResult<Course>(items, page.Page, page.Size, total, (int)Math.Ceiling(total / (double)page.Size));
    }

    // The WHERE clause is evaluated under InnoDB's row lock, so N concurrent callers can never take more seats than exist.
    public Task<int> TryReserveSeatAsync(long courseId, CancellationToken ct = default)
        => db.Courses.Where(c => c.CourseId == courseId && c.AvailableSeats > 0 && c.Status == CourseStatus.Active)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.AvailableSeats, c => c.AvailableSeats - 1)
                                      .SetProperty(c => c.Version, c => c.Version + 1)
                                      .SetProperty(c => c.UpdatedAt, _ => DateTime.UtcNow), ct);

    public Task<int> TryReleaseSeatAsync(long courseId, CancellationToken ct = default)
        => db.Courses.Where(c => c.CourseId == courseId && c.AvailableSeats < c.TotalSeats)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.AvailableSeats, c => c.AvailableSeats + 1)
                                      .SetProperty(c => c.Version, c => c.Version + 1)
                                      .SetProperty(c => c.UpdatedAt, _ => DateTime.UtcNow), ct);

    // Raw SQL on purpose: MySQL evaluates SET assignments LEFT TO RIGHT, so AvailableSeats must be assigned BEFORE TotalSeats (it reads the OLD TotalSeats).
    // EF's ExecuteUpdate does not guarantee that order, which silently produced available=0 when this was first written with SetProperty.
    public Task<int> ChangeCapacityAsync(long courseId, int total, CancellationToken ct = default)
        => db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE dn_courses SET AvailableSeats = AvailableSeats + ({total} - TotalSeats), TotalSeats = {total}, Version = Version + 1, UpdatedAt = UTC_TIMESTAMP(6)
               WHERE CourseId = {courseId} AND AvailableSeats + ({total} - TotalSeats) >= 0", ct);

    public Task<SeatReservation?> FindReservationAsync(long enrollmentId, CancellationToken ct = default) => db.Reservations.FirstOrDefaultAsync(r => r.EnrollmentId == enrollmentId, ct);
    public async Task AddReservationAsync(SeatReservation r, CancellationToken ct = default) => await db.Reservations.AddAsync(r, ct);
}

public interface ICategoryRepository
{
    Task<CourseCategory?> FindAsync(long id, CancellationToken ct = default);
    Task<bool> NameExistsAsync(string name, CancellationToken ct = default);
    Task<List<CourseCategory>> ListAsync(CancellationToken ct = default);
    Task AddAsync(CourseCategory c, CancellationToken ct = default);
    void Remove(CourseCategory c);
    Task SaveAsync(CancellationToken ct = default);
}

public class CategoryRepository(CourseDbContext db) : ICategoryRepository
{
    public Task<CourseCategory?> FindAsync(long id, CancellationToken ct = default) => db.Categories.FirstOrDefaultAsync(c => c.CategoryId == id, ct);
    public Task<bool> NameExistsAsync(string name, CancellationToken ct = default) { var n = name.Trim().ToLower(); return db.Categories.AnyAsync(c => c.Name.ToLower() == n, ct); }
    public Task<List<CourseCategory>> ListAsync(CancellationToken ct = default) => db.Categories.AsNoTracking().OrderBy(c => c.Name).ToListAsync(ct);
    public async Task AddAsync(CourseCategory c, CancellationToken ct = default) => await db.Categories.AddAsync(c, ct);
    public void Remove(CourseCategory c) => db.Categories.Remove(c);
    public Task SaveAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);
}

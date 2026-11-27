using Common.Errors;
using Common.Paging;
using EnrollmentService.Data;
using EnrollmentService.Dtos;
using EnrollmentService.Entities;
using Microsoft.EntityFrameworkCore;

namespace EnrollmentService.Queries;

// ---- read side of CQRS: query objects + handlers that never mutate state and never call other services -----------------------
public record GetEnrollmentQuery(long EnrollmentId);
public record SearchEnrollmentsQuery(long? StudentId, long? CourseId, EnrollmentStatus? Status, DateOnly? From, DateOnly? To, PageRequest Page);
public record StudentEnrollmentHistoryQuery(long StudentId, PageRequest Page);
public record CourseEnrollmentsQuery(long CourseId, EnrollmentStatus? Status, PageRequest Page);

public class EnrollmentQueryHandlers(EnrollmentDbContext db)
{
    public static readonly HashSet<string> Sortable = new() { "EnrollmentId", "StudentId", "CourseId", "Status", "EnrollmentDate", "CreatedAt" };

    public async Task<EnrollmentResponse> HandleAsync(GetEnrollmentQuery q, CancellationToken ct = default)
        => EnrollmentResponse.From(await db.Enrollments.AsNoTracking().FirstOrDefaultAsync(e => e.EnrollmentId == q.EnrollmentId, ct)
            ?? throw new NotFoundException($"Enrollment {q.EnrollmentId} not found"));

    public Task<PagedResult<EnrollmentResponse>> HandleAsync(SearchEnrollmentsQuery q, CancellationToken ct = default) => Run(q.StudentId, q.CourseId, q.Status, q.From, q.To, q.Page, ct);
    public Task<PagedResult<EnrollmentResponse>> HandleAsync(StudentEnrollmentHistoryQuery q, CancellationToken ct = default) => Run(q.StudentId, null, null, null, null, q.Page, ct);
    public Task<PagedResult<EnrollmentResponse>> HandleAsync(CourseEnrollmentsQuery q, CancellationToken ct = default) => Run(null, q.CourseId, q.Status, null, null, q.Page, ct);

    private async Task<PagedResult<EnrollmentResponse>> Run(long? studentId, long? courseId, EnrollmentStatus? status, DateOnly? from, DateOnly? to, PageRequest page, CancellationToken ct)
    {
        IQueryable<Enrollment> q = db.Enrollments.AsNoTracking();
        if (studentId != null) q = q.Where(e => e.StudentId == studentId);
        if (courseId != null) q = q.Where(e => e.CourseId == courseId);
        if (status != null) q = q.Where(e => e.Status == status);
        if (from != null) { var f = from.Value.ToDateTime(TimeOnly.MinValue); q = q.Where(e => e.EnrollmentDate >= f); }
        if (to != null) { var t = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue); q = q.Where(e => e.EnrollmentDate < t); }
        var total = await q.LongCountAsync(ct);
        var items = await q.OrderByName(page.SortBy, page.Descending).ThenBy(e => e.EnrollmentId).Skip(page.Page * page.Size).Take(page.Size).ToListAsync(ct);
        return new PagedResult<EnrollmentResponse>(items.Select(EnrollmentResponse.From).ToList(), page.Page, page.Size, total, (int)Math.Ceiling(total / (double)page.Size));
    }
}

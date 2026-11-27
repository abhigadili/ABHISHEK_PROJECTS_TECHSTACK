using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Repositories.Interfaces;

public interface ICourseSnapshotRepository : IRepository<CourseSnapshot>
{
    /// <summary>
    /// Inserts a new snapshot, or refreshes Title/Capacity on the existing one
    /// keyed by <paramref name="courseId"/>. Never touches EnrolledCount, which is
    /// owned locally by EnrollmentService, not by the upstream CourseCreated/Updated event.
    /// </summary>
    Task UpsertAsync(Guid courseId, string title, int capacity, CancellationToken cancellationToken = default);
}

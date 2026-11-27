using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.EnrollmentService.Entities;
using StudentMgmt.EnrollmentService.Repositories.Interfaces;

namespace StudentMgmt.EnrollmentService.Repositories;

public class CourseSnapshotRepository : RepositoryBase<CourseSnapshot>, ICourseSnapshotRepository
{
    public CourseSnapshotRepository(DbContext context) : base(context)
    {
    }

    public async Task UpsertAsync(Guid courseId, string title, int capacity, CancellationToken cancellationToken = default)
    {
        var existing = await GetByIdAsync(courseId, cancellationToken);
        if (existing is not null)
        {
            // EnrolledCount is intentionally left untouched — it is owned locally
            // by EnrollmentService, never by the upstream CourseUpdatedEvent.
            existing.Title = title;
            existing.Capacity = capacity;
            Update(existing);
        }
        else
        {
            var snapshot = new CourseSnapshot
            {
                Id = courseId,
                Title = title,
                Capacity = capacity,
                EnrolledCount = 0
            };
            await AddAsync(snapshot, cancellationToken);
        }
    }
}

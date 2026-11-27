using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.EnrollmentService.Entities;

/// <summary>
/// Local, read-only copy of just the course fields EnrollmentService needs
/// (title + capacity), kept eventually-consistent purely by consuming
/// CourseCreated/Updated/Deleted events from Kafka — EnrollmentService never
/// queries CourseDotnetDB directly (Database-per-Service).
///
/// <c>EnrolledCount</c> is the one field on this "snapshot" that is NOT owned by
/// the upstream CourseService: it is owned locally by EnrollmentService and
/// incremented/decremented as enrollments are created/cancelled here. A
/// CourseUpdatedEvent must never overwrite it — only Title/Capacity are
/// refreshed from that event (see <see cref="Services.SnapshotSyncService"/>).
///
/// <c>Id</c> is deliberately set to the originating CourseId so
/// <c>GetByIdAsync(courseId)</c> against this local table just works.
/// </summary>
public class CourseSnapshot : BaseEntity
{
    public string Title { get; set; } = default!;
    public int Capacity { get; set; }
    public int EnrolledCount { get; set; }
}

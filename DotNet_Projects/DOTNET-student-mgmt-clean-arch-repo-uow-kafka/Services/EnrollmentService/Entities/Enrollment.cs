using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.EnrollmentService.Entities;

/// <summary>
/// A single student's enrollment in a single course. This is the only entity
/// EnrollmentService truly owns and is the source of truth for; StudentId and
/// CourseId are foreign keys into other services' databases in spirit only —
/// there is no physical foreign key (Database-per-Service), they are validated
/// against the local <see cref="StudentSnapshot"/>/<see cref="CourseSnapshot"/>
/// read models instead.
/// </summary>
public class Enrollment : BaseEntity
{
    public Guid StudentId { get; set; }
    public Guid CourseId { get; set; }
    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Requested;
    public DateTime EnrolledOnUtc { get; set; }
    public DateTime? CancelledOnUtc { get; set; }
    public string? CancellationReason { get; set; }
}

using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.EnrollmentService.Entities;

/// <summary>
/// Local, read-only copy of just the student fields EnrollmentService needs to do
/// its job (display name + email for the events it publishes). This is NOT the
/// source of truth for student data — StudentService's own database is — this
/// table is kept eventually-consistent purely by consuming
/// StudentCreated/Updated/Deleted events from Kafka. Per the Database-per-Service
/// rule, EnrollmentService must never query StudentDotnetDB directly; this
/// snapshot is the only way it is allowed to know anything about a student.
///
/// <c>Id</c> is deliberately set to the originating StudentId (see
/// <see cref="Services.SnapshotSyncService"/>) instead of being left to
/// auto-generate, so <c>GetByIdAsync(studentId)</c> against this local table just
/// works with no separate id-mapping table required.
/// </summary>
public class StudentSnapshot : BaseEntity
{
    public string FullName { get; set; } = default!;
    public string Email { get; set; } = default!;
}

using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.CourseService.Entities;

/// <summary>
/// A course offered by the institution. CourseCode is the natural business key
/// (unique, e.g. "CS101") that EnrollmentService and other consumers reference
/// via the Kafka events published on create/update/delete rather than by
/// querying CourseDotnetDB directly (database-per-service).
/// </summary>
public class Course : BaseEntity
{
    public string CourseCode { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Description { get; set; } = default!;
    public int Credits { get; set; }
    public int Capacity { get; set; }
    public string InstructorName { get; set; } = default!;
    public bool IsActive { get; set; } = true;
}

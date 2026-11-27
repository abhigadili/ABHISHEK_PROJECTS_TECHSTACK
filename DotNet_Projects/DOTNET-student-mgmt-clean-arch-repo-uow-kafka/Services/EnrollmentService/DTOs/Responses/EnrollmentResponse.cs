using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.DTOs.Responses;

public class EnrollmentResponse
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string StudentFullName { get; set; } = default!;
    public Guid CourseId { get; set; }
    public string CourseTitle { get; set; } = default!;
    public EnrollmentStatus Status { get; set; }
    public DateTime EnrolledOnUtc { get; set; }
    public DateTime? CancelledOnUtc { get; set; }
    public string? CancellationReason { get; set; }
}

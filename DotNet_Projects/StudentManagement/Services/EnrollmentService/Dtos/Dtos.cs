using System.ComponentModel.DataAnnotations;
using EnrollmentService.Entities;

namespace EnrollmentService.Dtos;

public record EnrollmentRequest([Required, Range(1, long.MaxValue)] long? StudentId, [Required, Range(1, long.MaxValue)] long? CourseId);
public record CancelRequest([StringLength(500)] string? Reason);
public record EnrollmentUpdateRequest([StringLength(500)] string? Remarks);

public record EnrollmentResponse(long EnrollmentId, long StudentId, long CourseId, string? StudentName, string? CourseName, DateTime EnrollmentDate,
    EnrollmentStatus EnrollmentStatus, string? Remarks, DateTime CreatedAt, DateTime UpdatedAt)
{
    public static EnrollmentResponse From(Enrollment e) => new(e.EnrollmentId, e.StudentId, e.CourseId, e.StudentName, e.CourseName, e.EnrollmentDate, e.Status, e.Remarks, e.CreatedAt, e.UpdatedAt);
}

/// <summary>Result of the create command: Confirmed, Rejected (reason in Message) or InProgress (saga paused; it will be resumed automatically).</summary>
public record EnrollmentOutcome(string Result, string Message, EnrollmentResponse? Enrollment)
{
    public const string Confirmed = "Confirmed";
    public const string Rejected = "Rejected";
    public const string InProgress = "InProgress";
}

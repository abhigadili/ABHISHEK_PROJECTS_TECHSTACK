using System.ComponentModel.DataAnnotations;
using CourseService.Entities;

namespace CourseService.Dtos;

public record CategoryRequest([Required, StringLength(80)] string Name, [StringLength(255)] string? Description);
public record CategoryResponse(long CategoryId, string Name, string? Description);

public record CourseRequest(
    [Required, StringLength(120)] string CourseName,
    [Required, RegularExpression("^[A-Z0-9][A-Z0-9-]{1,19}$", ErrorMessage = "must be upper-case letters, digits or '-' (2-20 chars), e.g. CS-101")] string CourseCode,
    [StringLength(5000)] string? Description,
    long? CategoryId,
    [Required, Range(1, 520)] int? DurationWeeks,
    [Required, Range(0, 99999999.99)] decimal? Fees,
    [Required, Range(0, 100000)] int? TotalSeats,
    CourseStatus? Status);

public record CourseResponse(long CourseId, string CourseName, string CourseCode, string? Description, long? CategoryId, string? CategoryName,
    int DurationWeeks, decimal Fees, int TotalSeats, int AvailableSeats, CourseStatus Status, DateTime CreatedAt, DateTime UpdatedAt);

public record CourseAvailabilityResponse(long CourseId, CourseStatus Status, int TotalSeats, int AvailableSeats, bool Available);
public record StatusRequest([Required] CourseStatus? Status);
public record SeatRequest([Required] long? EnrollmentId);
/// <summary>Replayed = true means the same EnrollmentId had already performed this operation (idempotent no-op).</summary>
public record SeatResponse(long CourseId, long EnrollmentId, string ReservationStatus, int AvailableSeats, bool Replayed);

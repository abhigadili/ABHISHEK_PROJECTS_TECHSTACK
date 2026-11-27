namespace CourseService.Entities;

public enum CourseStatus { Active, Inactive }
public enum ReservationStatus { Reserved, Released }

public class CourseCategory
{
    public long CategoryId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>TotalSeats/AvailableSeats are never written by normal entity saves: they change only through the atomic conditional UPDATE statements in CourseRepository.</summary>
public class Course
{
    public long CourseId { get; set; }
    public string CourseName { get; set; } = "";
    public string CourseCode { get; set; } = "";
    public string? Description { get; set; }
    public long? CategoryId { get; set; }
    public CourseCategory? Category { get; set; }
    public int DurationWeeks { get; set; }
    public decimal Fees { get; set; }
    public int TotalSeats { get; set; }
    public int AvailableSeats { get; set; }
    public CourseStatus Status { get; set; } = CourseStatus.Active;
    /// <summary>Optimistic concurrency token; also bumped by the atomic seat statements so concurrent PUTs fail with 409.</summary>
    public long Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>One row per enrollment that ever reserved a seat: makes reserve/release idempotent per EnrollmentId. EnrollmentId is a logical reference (no cross-database FK).</summary>
public class SeatReservation
{
    public long ReservationId { get; set; }
    public long EnrollmentId { get; set; }
    public long CourseId { get; set; }
    public ReservationStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

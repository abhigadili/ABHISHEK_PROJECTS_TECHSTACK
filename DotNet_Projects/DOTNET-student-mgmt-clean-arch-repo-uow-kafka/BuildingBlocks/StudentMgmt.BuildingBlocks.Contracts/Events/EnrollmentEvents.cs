namespace StudentMgmt.BuildingBlocks.Contracts.Events;

public sealed class EnrollmentCreatedEvent : IntegrationEvent
{
    public Guid EnrollmentId { get; init; }
    public Guid StudentId { get; init; }
    public Guid CourseId { get; init; }
    public string StudentEmail { get; init; } = default!;
    public string StudentFullName { get; init; } = default!;
    public string CourseTitle { get; init; } = default!;
    public DateTime EnrolledOnUtc { get; init; }
}

public sealed class EnrollmentCancelledEvent : IntegrationEvent
{
    public Guid EnrollmentId { get; init; }
    public Guid StudentId { get; init; }
    public Guid CourseId { get; init; }
    public string StudentEmail { get; init; } = default!;
    public string Reason { get; init; } = default!;
}

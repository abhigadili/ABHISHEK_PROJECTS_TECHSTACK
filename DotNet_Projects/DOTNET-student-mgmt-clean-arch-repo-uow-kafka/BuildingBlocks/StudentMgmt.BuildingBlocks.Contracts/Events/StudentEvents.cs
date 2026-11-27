namespace StudentMgmt.BuildingBlocks.Contracts.Events;

public sealed class StudentCreatedEvent : IntegrationEvent
{
    public Guid StudentId { get; init; }
    public string FirstName { get; init; } = default!;
    public string LastName { get; init; } = default!;
    public string Email { get; init; } = default!;
    public DateTime DateOfBirth { get; init; }
    public string EnrollmentNumber { get; init; } = default!;
}

public sealed class StudentUpdatedEvent : IntegrationEvent
{
    public Guid StudentId { get; init; }
    public string FirstName { get; init; } = default!;
    public string LastName { get; init; } = default!;
    public string Email { get; init; } = default!;
    public string EnrollmentNumber { get; init; } = default!;
}

public sealed class StudentDeletedEvent : IntegrationEvent
{
    public Guid StudentId { get; init; }
    public string EnrollmentNumber { get; init; } = default!;
}

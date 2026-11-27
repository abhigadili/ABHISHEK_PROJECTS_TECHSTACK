namespace StudentMgmt.BuildingBlocks.Contracts.Events;

public sealed class CourseCreatedEvent : IntegrationEvent
{
    public Guid CourseId { get; init; }
    public string CourseCode { get; init; } = default!;
    public string Title { get; init; } = default!;
    public int Credits { get; init; }
    public int Capacity { get; init; }
}

public sealed class CourseUpdatedEvent : IntegrationEvent
{
    public Guid CourseId { get; init; }
    public string CourseCode { get; init; } = default!;
    public string Title { get; init; } = default!;
    public int Credits { get; init; }
    public int Capacity { get; init; }
}

public sealed class CourseDeletedEvent : IntegrationEvent
{
    public Guid CourseId { get; init; }
    public string CourseCode { get; init; } = default!;
}

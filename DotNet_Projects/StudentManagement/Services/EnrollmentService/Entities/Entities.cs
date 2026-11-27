namespace EnrollmentService.Entities;

public enum EnrollmentStatus
{
    Pending, Confirmed, Rejected, Cancelled
}

public static class EnrollmentStatusExtensions
{
    /// <summary>State machine: Pending → Confirmed | Rejected, Confirmed → Cancelled. Rejected and Cancelled are terminal.</summary>
    public static EnrollmentStatus[] AllowedNext(this EnrollmentStatus s) => s switch
    {
        EnrollmentStatus.Pending => new[] { EnrollmentStatus.Confirmed, EnrollmentStatus.Rejected },
        EnrollmentStatus.Confirmed => new[] { EnrollmentStatus.Cancelled },
        _ => Array.Empty<EnrollmentStatus>(),
    };
}

public class Enrollment
{
    public long EnrollmentId { get; set; }
    public long StudentId { get; set; }            // logical references: no cross-database foreign keys
    public long CourseId { get; set; }
    public string? StudentName { get; set; }       // snapshots taken at enrollment time (used in events)
    public string? StudentEmail { get; set; }
    public string? CourseName { get; set; }
    public DateTime EnrollmentDate { get; set; }
    public EnrollmentStatus Status { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public string? Remarks { get; set; }
    /// <summary>Database-generated (STORED): non-null only for Pending/Confirmed and UNIQUE → blocks duplicate active enrollments even under races.</summary>
    public string? ActiveKey { get; private set; }
    public long Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public void TransitionTo(EnrollmentStatus next)
    {
        if (!Status.AllowedNext().Contains(next))
            throw new Common.Errors.BusinessRuleException($"Enrollment {EnrollmentId} cannot move from {Status} to {next}");
        Status = next;
    }
}

public enum SagaState { Started, StudentValidated, CourseValidated, PendingCreated, SeatReserved, Completed, Compensating, Rejected }

public static class SagaStateExtensions { public static bool IsTerminal(this SagaState s) => s is SagaState.Completed or SagaState.Rejected; }

/// <summary>Persistent saga state: the orchestrator saves it after every step, so a crashed instance can be resumed.</summary>
public class SagaInstance
{
    public long SagaId { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public long StudentId { get; set; }
    public long CourseId { get; set; }
    public long? EnrollmentId { get; set; }
    public SagaState State { get; set; } = SagaState.Started;
    public bool SeatReserved { get; set; }
    public string? FailureReason { get; set; }
    public string? StudentName { get; set; }
    public string? StudentEmail { get; set; }
    public string? CourseName { get; set; }
    public string? CorrelationId { get; set; }
    public int Attempts { get; set; }
    public long Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum OutboxStatus { Pending, Published }

/// <summary>Transactional outbox row: written in the same local transaction as the business change, published to RabbitMQ by OutboxPublisher.</summary>
public class OutboxMessage
{
    public long OutboxId { get; set; }
    public string EventId { get; set; } = "";
    public long AggregateId { get; set; }
    public string EventType { get; set; } = "";
    public string RoutingKey { get; set; } = "";
    public string Payload { get; set; } = "";
    public string? CorrelationId { get; set; }
    public OutboxStatus Status { get; set; } = OutboxStatus.Pending;
    public int Attempts { get; set; }
    public DateTime NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
}

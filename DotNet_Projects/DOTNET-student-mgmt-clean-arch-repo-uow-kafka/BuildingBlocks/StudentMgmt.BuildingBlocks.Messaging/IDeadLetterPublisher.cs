namespace StudentMgmt.BuildingBlocks.Messaging;

/// <summary>
/// Publishes a message that has exhausted every consumer-side retry to that
/// topic's Dead Letter Queue (e.g. "enrollment.created.dlq") instead of losing it
/// or blocking the partition. Ops can inspect/replay the DLQ topic later.
/// </summary>
public interface IDeadLetterPublisher
{
    Task PublishAsync(string originalTopic, string rawMessage, string failureReason, CancellationToken cancellationToken = default);
}

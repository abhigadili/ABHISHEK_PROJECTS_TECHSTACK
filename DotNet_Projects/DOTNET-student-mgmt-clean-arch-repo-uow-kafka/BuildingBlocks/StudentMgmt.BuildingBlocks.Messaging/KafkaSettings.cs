namespace StudentMgmt.BuildingBlocks.Messaging;

/// <summary>
/// Bound from the "Kafka" section of appsettings.json (Options Pattern).
/// Every service points at the same broker but uses its own ConsumerGroupId so
/// each service gets its own independent copy of every message it subscribes to.
/// </summary>
public class KafkaSettings
{
    public const string SectionName = "Kafka";

    public string BootstrapServers { get; set; } = "localhost:9092";
    public string ConsumerGroupId { get; set; } = "student-mgmt-default-group";
    public string ClientId { get; set; } = "student-mgmt-service";
    public int MaxRetryAttempts { get; set; } = 3;
    public int RetryBaseDelayMilliseconds { get; set; } = 200;
    public bool EnableAutoCommit { get; set; } = false;
}

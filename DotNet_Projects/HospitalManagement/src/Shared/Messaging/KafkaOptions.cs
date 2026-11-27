namespace HMS.Shared.Messaging;

public sealed class KafkaOptions
{
    public string BootstrapServers { get; set; } = "localhost:29092";
    public string GroupId { get; set; } = "hospital";
    public int OutboxPollIntervalMs { get; set; } = 1000;
    public int OutboxBatchSize { get; set; } = 50;
    public int MaxProcessingAttempts { get; set; } = 3;
    public int RetryBaseDelayMs { get; set; } = 500;
}

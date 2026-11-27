using Confluent.Kafka;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudentMgmt.BuildingBlocks.Contracts;

namespace StudentMgmt.BuildingBlocks.Messaging;

/// <summary>
/// Singleton (owns its own long-lived Kafka producer connection, same rationale
/// as <see cref="KafkaEventProducer"/>).
/// </summary>
public sealed class DeadLetterPublisher : IDeadLetterPublisher, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<DeadLetterPublisher> _logger;

    public DeadLetterPublisher(IOptions<KafkaSettings> options, ILogger<DeadLetterPublisher> logger)
    {
        _logger = logger;
        var config = new ProducerConfig
        {
            BootstrapServers = options.Value.BootstrapServers,
            ClientId = $"{options.Value.ClientId}-dlq"
        };
        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public async Task PublishAsync(string originalTopic, string rawMessage, string failureReason, CancellationToken cancellationToken = default)
    {
        var dlqTopic = KafkaTopics.DeadLetterFor(originalTopic);
        var message = new Message<string, string>
        {
            Key = Guid.NewGuid().ToString(),
            Value = rawMessage,
            Headers = new Headers
            {
                { "originalTopic", System.Text.Encoding.UTF8.GetBytes(originalTopic) },
                { "failureReason", System.Text.Encoding.UTF8.GetBytes(failureReason) },
                { "deadLetteredAtUtc", System.Text.Encoding.UTF8.GetBytes(DateTime.UtcNow.ToString("O")) }
            }
        };

        await _producer.ProduceAsync(dlqTopic, message, cancellationToken);
        _logger.LogWarning(
            "Message from {OriginalTopic} moved to dead-letter queue {DlqTopic}. Reason: {Reason}",
            originalTopic, dlqTopic, failureReason);
    }

    public void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(5));
        _producer.Dispose();
    }
}

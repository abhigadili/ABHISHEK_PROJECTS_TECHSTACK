using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Retry;
using StudentMgmt.BuildingBlocks.Contracts.Events;

namespace StudentMgmt.BuildingBlocks.Messaging;

/// <summary>
/// Singleton implementation of <see cref="IEventProducer"/>. Wraps every publish
/// in a Polly retry pipeline (exponential backoff) so a transient broker hiccup
/// doesn't fail the caller's request; if every retry is exhausted the message is
/// still logged with full context so it can be replayed manually.
/// </summary>
public sealed class KafkaEventProducer : IEventProducer, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<KafkaEventProducer> _logger;
    private readonly KafkaSettings _settings;
    private readonly ResiliencePipeline _retryPipeline;

    public KafkaEventProducer(IOptions<KafkaSettings> options, ILogger<KafkaEventProducer> logger)
    {
        _settings = options.Value;
        _logger = logger;

        var config = new ProducerConfig
        {
            BootstrapServers = _settings.BootstrapServers,
            ClientId = _settings.ClientId,
            Acks = Acks.All,
            EnableIdempotence = true,
            MessageSendMaxRetries = 3,
            RetryBackoffMs = 100
        };

        _producer = new ProducerBuilder<string, string>(config)
            .SetErrorHandler((_, error) => _logger.LogError("Kafka producer error: {Reason} (IsFatal: {IsFatal})", error.Reason, error.IsFatal))
            .Build();

        _retryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = _settings.MaxRetryAttempts,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromMilliseconds(_settings.RetryBaseDelayMilliseconds),
                OnRetry = args =>
                {
                    _logger.LogWarning(
                        args.Outcome.Exception,
                        "Retrying Kafka publish, attempt {Attempt} after {Delay}ms",
                        args.AttemptNumber + 1,
                        args.RetryDelay.TotalMilliseconds);
                    return ValueTask.CompletedTask;
                }
            })
            .Build();
    }

    public async Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : IntegrationEvent
    {
        var payload = JsonSerializer.Serialize(@event);
        var message = new Message<string, string>
        {
            Key = @event.EventId.ToString(),
            Value = payload,
            Headers = new Headers
            {
                { "correlationId", System.Text.Encoding.UTF8.GetBytes(@event.CorrelationId.ToString()) },
                { "eventType", System.Text.Encoding.UTF8.GetBytes(typeof(TEvent).Name) }
            }
        };

        try
        {
            await _retryPipeline.ExecuteAsync(async ct =>
            {
                var result = await _producer.ProduceAsync(topic, message, ct);
                _logger.LogInformation(
                    "Published {EventType} (EventId: {EventId}, CorrelationId: {CorrelationId}) to {Topic}/{Partition}@{Offset}",
                    typeof(TEvent).Name, @event.EventId, @event.CorrelationId, topic, result.Partition.Value, result.Offset.Value);
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to publish {EventType} (EventId: {EventId}) to {Topic} after {MaxRetries} retries",
                typeof(TEvent).Name, @event.EventId, topic, _settings.MaxRetryAttempts);
            throw;
        }
    }

    public void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(5));
        _producer.Dispose();
    }
}

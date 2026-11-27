using Confluent.Kafka;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Retry;

namespace StudentMgmt.BuildingBlocks.Messaging;

/// <summary>
/// Hosted Background Service base class every Kafka consumer in every microservice
/// inherits from. Subclasses only implement <see cref="HandleMessageAsync"/> with
/// their own deserialization + business logic; this base class owns the consume
/// loop, per-message retry (Polly), dead-lettering on exhausted retries, manual
/// offset commit, and graceful shutdown.
/// </summary>
public abstract class KafkaConsumerBase : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly KafkaSettings _settings;
    private readonly ILogger _logger;
    private readonly ResiliencePipeline _retryPipeline;

    protected abstract string[] Topics { get; }

    protected KafkaConsumerBase(
        IServiceProvider serviceProvider,
        IOptions<KafkaSettings> options,
        ILogger logger)
    {
        _serviceProvider = serviceProvider;
        _settings = options.Value;
        _logger = logger;

        _retryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = _settings.MaxRetryAttempts,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromMilliseconds(_settings.RetryBaseDelayMilliseconds)
            })
            .Build();
    }

    /// <summary>
    /// Deserialize <paramref name="rawMessage"/> based on the "eventType" header and
    /// apply business logic. Throw to trigger a retry (and, if retries are
    /// exhausted, a dead-letter).
    /// </summary>
    protected abstract Task HandleMessageAsync(
        string topic,
        string? eventType,
        string rawMessage,
        IServiceProvider scopedServiceProvider,
        CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = new ConsumerConfig
        {
            BootstrapServers = _settings.BootstrapServers,
            GroupId = _settings.ConsumerGroupId,
            ClientId = _settings.ClientId,
            EnableAutoCommit = _settings.EnableAutoCommit,
            AutoOffsetReset = AutoOffsetReset.Earliest
        };

        using var consumer = new ConsumerBuilder<string, string>(config)
            .SetErrorHandler((_, error) => _logger.LogError("Kafka consumer error: {Reason}", error.Reason))
            .Build();

        consumer.Subscribe(Topics);
        _logger.LogInformation("{Consumer} subscribed to topics: {Topics}", GetType().Name, string.Join(", ", Topics));

        await Task.Yield();

        while (!stoppingToken.IsCancellationRequested)
        {
            ConsumeResult<string, string>? result = null;
            try
            {
                result = consumer.Consume(TimeSpan.FromSeconds(1));
                if (result?.Message is null)
                {
                    continue;
                }

                var eventType = result.Message.Headers.TryGetLastBytes("eventType", out var eventTypeBytes)
                    ? System.Text.Encoding.UTF8.GetString(eventTypeBytes)
                    : null;

                using var scope = _serviceProvider.CreateScope();

                await _retryPipeline.ExecuteAsync(async ct =>
                    await HandleMessageAsync(result.Topic, eventType, result.Message.Value, scope.ServiceProvider, ct),
                    stoppingToken);

                consumer.Commit(result);
            }
            catch (ConsumeException ex)
            {
                _logger.LogError(ex, "Kafka consume error on {Consumer}", GetType().Name);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex) when (result is not null)
            {
                _logger.LogError(ex, "Exhausted retries handling message from {Topic}, sending to DLQ", result.Topic);

                var dlqPublisher = _serviceProvider.GetService<IDeadLetterPublisher>();
                if (dlqPublisher is not null)
                {
                    await dlqPublisher.PublishAsync(result.Topic, result.Message.Value, ex.Message, stoppingToken);
                }

                consumer.Commit(result);
            }
        }

        consumer.Close();
    }
}

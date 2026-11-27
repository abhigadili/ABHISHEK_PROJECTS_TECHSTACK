using System.Diagnostics;
using System.Text;
using EventContracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Messaging;

public class RabbitMqOptions
{
    public const string Section = "RabbitMq";
    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
}

/// <summary>One shared, auto-recovering connection per process (channels are created per publisher/consumer).</summary>
public sealed class RabbitMqConnection : IDisposable
{
    private readonly ConnectionFactory _factory;
    private IConnection? _conn;
    private readonly object _lock = new();

    public RabbitMqConnection(IOptions<RabbitMqOptions> o)
    {
        var v = o.Value;
        _factory = new ConnectionFactory
        {
            HostName = v.HostName, Port = v.Port, UserName = v.UserName, Password = v.Password, VirtualHost = v.VirtualHost,
            DispatchConsumersAsync = true, AutomaticRecoveryEnabled = true, NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
            RequestedConnectionTimeout = TimeSpan.FromSeconds(3), ClientProvidedName = AppDomain.CurrentDomain.FriendlyName,
        };
    }

    public IConnection Get()
    {
        if (_conn is { IsOpen: true }) return _conn;
        lock (_lock)
        {
            if (_conn is { IsOpen: true }) return _conn;
            _conn?.Dispose();
            _conn = _factory.CreateConnection();
            return _conn;
        }
    }

    public void Dispose() { try { _conn?.Dispose(); } catch { } }
}

public static class MessagingTelemetry
{
    public const string SourceName = "Messaging";
    public static readonly ActivitySource Source = new(SourceName);
}

/// <summary>Idempotent declaration of the exchanges, queues, bindings and dead-letter queues. Called by publishers AND consumers so no message is published into a void.</summary>
public static class RabbitMqTopology
{
    public static void Declare(IModel ch)
    {
        ch.ExchangeDeclare(Topology.Exchange, ExchangeType.Topic, durable: true);
        ch.ExchangeDeclare(Topology.DeadLetterExchange, ExchangeType.Direct, durable: true);
        DeclareQueue(ch, Topology.EnrollmentQueue, Topology.EnrollmentBinding);
        DeclareQueue(ch, Topology.CourseQueue, Topology.CourseBinding);
    }

    private static void DeclareQueue(IModel ch, string queue, string binding)
    {
        var dlq = Topology.DeadLetterQueue(queue);
        ch.QueueDeclare(dlq, durable: true, exclusive: false, autoDelete: false);
        ch.QueueBind(dlq, Topology.DeadLetterExchange, routingKey: queue);
        ch.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false, arguments: new Dictionary<string, object>
        {
            ["x-dead-letter-exchange"] = Topology.DeadLetterExchange,
            ["x-dead-letter-routing-key"] = queue,
        });
        ch.QueueBind(queue, Topology.Exchange, binding);
    }
}

public interface IEventPublisher
{
    /// <summary>Publishes a persistent message and waits for the broker's publisher confirm. Throws if the broker did not confirm.</summary>
    void Publish(string routingKey, string messageId, string eventType, string jsonPayload, string? correlationId = null);
}

public sealed class RabbitMqEventPublisher : IEventPublisher, IDisposable
{
    private readonly RabbitMqConnection _conn;
    private readonly ILogger<RabbitMqEventPublisher> _log;
    private IModel? _ch;
    private readonly object _lock = new();

    public RabbitMqEventPublisher(RabbitMqConnection conn, ILogger<RabbitMqEventPublisher> log) { _conn = conn; _log = log; }

    public void Publish(string routingKey, string messageId, string eventType, string jsonPayload, string? correlationId = null)
    {
        lock (_lock)   // IModel is not thread-safe
        {
            if (_ch is not { IsOpen: true })
            {
                _ch?.Dispose();
                _ch = _conn.Get().CreateModel();
                _ch.ConfirmSelect();
                RabbitMqTopology.Declare(_ch);
            }
            var props = _ch.CreateBasicProperties();
            props.Persistent = true;                       // delivery-mode 2: survives a broker restart (queues are durable)
            props.ContentType = "application/json";
            props.MessageId = messageId;
            props.Type = eventType;
            props.CorrelationId = correlationId;
            // W3C trace context travels in a header so the consumer's span joins the producer's trace
            if (Activity.Current?.Id is { } tp) props.Headers = new Dictionary<string, object> { ["traceparent"] = tp };
            props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            _ch.BasicPublish(Topology.Exchange, routingKey, mandatory: false, props, Encoding.UTF8.GetBytes(jsonPayload));
            _ch.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
            _log.LogInformation("Published {EventType} messageId={MessageId} routingKey={RoutingKey}", eventType, messageId, routingKey);
        }
    }

    public void Dispose() { try { _ch?.Dispose(); } catch { } }
}

/// <summary>
/// Base class for queue consumers: manual acknowledgement, bounded in-process retry with exponential back-off,
/// then the message is rejected without requeue so the broker dead-letters it into "&lt;queue&gt;.dlq".
/// Handlers must be idempotent: a message can be delivered more than once.
/// </summary>
public abstract class RabbitMqConsumer : BackgroundService
{
    private readonly RabbitMqConnection _conn;
    private readonly ILogger _log;
    private readonly string _queue;
    private readonly int _maxAttempts;
    private readonly TimeSpan _baseDelay;
    private IModel? _ch;

    protected RabbitMqConsumer(RabbitMqConnection conn, ILogger log, string queue, int maxAttempts = 4, TimeSpan? baseDelay = null)
    { _conn = conn; _log = log; _queue = queue; _maxAttempts = maxAttempts; _baseDelay = baseDelay ?? TimeSpan.FromSeconds(1); }

    protected abstract Task HandleAsync(string routingKey, string messageId, string eventType, string json, CancellationToken ct);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        // connect with retry: the broker may start after this service
        while (!stop.IsCancellationRequested)
        {
            try { Start(stop); break; }
            catch (Exception e) { _log.LogWarning("RabbitMQ not reachable for queue {Queue}: {Msg}; retrying in 5s", _queue, e.Message); await Task.Delay(5000, stop); }
        }
        try { await Task.Delay(Timeout.Infinite, stop); } catch (OperationCanceledException) { }
    }

    private void Start(CancellationToken stop)
    {
        _ch = _conn.Get().CreateModel();
        RabbitMqTopology.Declare(_ch);
        _ch.BasicQos(0, 10, false);
        var consumer = new AsyncEventingBasicConsumer(_ch);
        consumer.Received += async (_, ea) => await OnMessage(ea, stop);
        _ch.BasicConsume(_queue, autoAck: false, consumer);
        _log.LogInformation("Consuming queue {Queue}", _queue);
    }

    private async Task OnMessage(BasicDeliverEventArgs ea, CancellationToken stop)
    {
        var id = ea.BasicProperties.MessageId ?? "(none)";
        var json = Encoding.UTF8.GetString(ea.Body.Span);
        string? parent = ea.BasicProperties.Headers is { } h && h.TryGetValue("traceparent", out var tp) && tp is byte[] b ? Encoding.UTF8.GetString(b) : null;
        using var activity = MessagingTelemetry.Source.StartActivity("rabbitmq process " + _queue, ActivityKind.Consumer, parent);
        activity?.SetTag("messaging.message_id", id);
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await HandleAsync(ea.RoutingKey, id, ea.BasicProperties.Type ?? "", json, stop);
                _ch!.BasicAck(ea.DeliveryTag, false);
                _log.LogInformation("Processed {RoutingKey} messageId={MessageId} (attempt {Attempt})", ea.RoutingKey, id, attempt);
                return;
            }
            catch (Exception e) when (attempt < _maxAttempts && !stop.IsCancellationRequested)
            {
                var delay = TimeSpan.FromMilliseconds(_baseDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));
                _log.LogWarning("Handler failed for messageId={MessageId} attempt {Attempt}/{Max}: {Msg}; retry in {Delay}", id, attempt, _maxAttempts, e.Message, delay);
                await Task.Delay(delay, stop);
            }
            catch (Exception e)
            {
                _log.LogError(e, "Dead-lettering messageId={MessageId} from {Queue} after {Attempt} attempts", id, _queue, attempt);
                _ch!.BasicNack(ea.DeliveryTag, false, requeue: false);   // → x-dead-letter-exchange → <queue>.dlq
                return;
            }
        }
    }

    public override void Dispose() { try { _ch?.Dispose(); } catch { } base.Dispose(); }
}

public class RabbitMqHealthCheck(RabbitMqConnection conn) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try { using var ch = conn.Get().CreateModel(); return Task.FromResult(HealthCheckResult.Healthy("connected")); }
        catch (Exception e) { return Task.FromResult(HealthCheckResult.Unhealthy("RabbitMQ unreachable", e)); }
    }
}

public static class MessagingExtensions
{
    public static IServiceCollection AddSmsRabbitMq(this IServiceCollection services, IConfiguration config, bool publisher)
    {
        services.Configure<RabbitMqOptions>(config.GetSection(RabbitMqOptions.Section));
        services.AddSingleton<RabbitMqConnection>();
        if (publisher) services.AddSingleton<IEventPublisher, RabbitMqEventPublisher>();
        services.AddHealthChecks().AddCheck<RabbitMqHealthCheck>("rabbitmq", tags: new[] { "ready" });
        return services;
    }
}

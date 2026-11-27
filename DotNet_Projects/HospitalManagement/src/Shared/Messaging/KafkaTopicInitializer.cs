using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HMS.Shared.Messaging;

/// <summary>Creates every topic (and its .DLT) that does not exist yet. Idempotent; failures are logged, never fatal.</summary>
public sealed class KafkaTopicInitializer(IOptions<KafkaOptions> options, ILogger<KafkaTopicInitializer> log) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        try
        {
            using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = options.Value.BootstrapServers, SocketTimeoutMs = 5000 }).Build();
            var existing = admin.GetMetadata(TimeSpan.FromSeconds(5)).Topics.Select(t => t.Topic).ToHashSet();
            var specs = Topics.All.SelectMany(t => new[] { t, Topics.Dlt(t) }).Where(t => !existing.Contains(t))
                .Select(t => new TopicSpecification { Name = t, NumPartitions = 3, ReplicationFactor = 1 }).ToList();
            if (specs.Count == 0) return;
            await admin.CreateTopicsAsync(specs);
            log.LogInformation("Created {Count} Kafka topics", specs.Count);
        }
        catch (CreateTopicsException ex) { log.LogInformation("Kafka topic creation finished with notes: {Reasons}", string.Join("; ", ex.Results.Select(r => r.Error.Reason))); }
        catch (Exception ex) { log.LogWarning("Kafka topic initialisation skipped: {Error}", ex.Message); }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}

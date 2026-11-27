using System.Text.Json;
using EventContracts;
using Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NotificationService.Consumers;
using NotificationService.Data;
using NotificationService.Entities;
using NotificationService.Services;
using RabbitMQ.Client;

namespace IntegrationTests;

/// <summary>RabbitMQ publish → consume → MySQL inbox/notification, duplicate delivery and dead-lettering against real containers.</summary>
[Collection("infra")]
public class NotificationMessagingIntegrationTests(InfraFixture infra) : IAsyncLifetime
{
    private string _cs = "";
    private ServiceProvider _sp = null!;
    private RabbitMqConnection _conn = null!;
    private EnrollmentEventsConsumer _consumer = null!;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task InitializeAsync()
    {
        _cs = await infra.NewDatabaseAsync("notif");
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<NotificationDbContext>(o => o.UseMySql(_cs, new MySqlServerVersion(new Version(8, 0, 36)), m => m.EnableRetryOnFailure(3)));
        services.AddScoped<INotificationIngestService, NotificationIngestService>();
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Notification:AdminEmail"] = "ops@sms.local", ["Notification:ConsumerMaxAttempts"] = "2", ["Notification:ConsumerRetryDelayMs"] = "100" }).Build();
        services.AddSingleton<IConfiguration>(cfg);
        _sp = services.BuildServiceProvider();
        using (var scope = _sp.CreateScope()) await scope.ServiceProvider.GetRequiredService<NotificationDbContext>().Database.MigrateAsync();

        _conn = new RabbitMqConnection(Options.Create(infra.RabbitOptions));
        using (var ch = _conn.Get().CreateModel()) { RabbitMqTopology.Declare(ch); ch.QueuePurge(Topology.EnrollmentQueue); ch.QueuePurge(Topology.DeadLetterQueue(Topology.EnrollmentQueue)); }
        _consumer = new EnrollmentEventsConsumer(_conn, _sp.GetRequiredService<IServiceScopeFactory>(), NullLogger<EnrollmentEventsConsumer>.Instance, cfg);
        await _consumer.StartAsync(CancellationToken.None);       // BackgroundService: starts consuming
    }

    public async Task DisposeAsync() { await _consumer.StopAsync(CancellationToken.None); _conn.Dispose(); await _sp.DisposeAsync(); }

    private static EnrollmentEvent Ev(string id, string type, long enrollment) => new(id, type, enrollment, 7, 5, "Asha Rao", "asha@example.com", "Java", null, "corr", DateTimeOffset.UtcNow);

    private void Publish(EnrollmentEvent e)
    {
        using var pub = new RabbitMqEventPublisher(_conn, NullLogger<RabbitMqEventPublisher>.Instance);
        pub.Publish(EventTypes.RoutingKey(e.EventType), e.EventId, e.EventType, JsonSerializer.Serialize(e, Json), e.CorrelationId);
    }

    private async Task<T?> Eventually<T>(Func<Task<T?>> probe, int seconds = 20) where T : class
    {
        for (var i = 0; i < seconds * 10; i++) { var v = await probe(); if (v != null) return v; await Task.Delay(100); }
        return null;
    }

    private async Task<List<Notification>> Notifications() { using var s = _sp.CreateScope(); return await s.ServiceProvider.GetRequiredService<NotificationDbContext>().Notifications.AsNoTracking().ToListAsync(); }

    [Fact]
    public async Task Published_event_is_consumed_and_becomes_a_pending_notification()
    {
        Publish(Ev("evt-1", EventTypes.EnrollmentConfirmed, 1001));
        var n = await Eventually(async () => (await Notifications()).FirstOrDefault(x => x.EnrollmentId == 1001));
        Assert.NotNull(n);
        Assert.Equal(NotificationType.EnrollmentConfirmed, n!.NotificationType); Assert.Equal("asha@example.com", n.RecipientEmail); Assert.Equal(NotificationStatus.Pending, n.Status);
    }

    [Fact]
    public async Task The_same_message_delivered_twice_creates_one_notification_and_one_inbox_row()
    {
        var e = Ev("dup-evt", EventTypes.EnrollmentCancelled, 1002);
        Publish(e); Publish(e);
        Assert.NotNull(await Eventually(async () => (await Notifications()).FirstOrDefault(x => x.EnrollmentId == 1002)));
        await Task.Delay(1500);                                                         // give the duplicate time to be processed
        Assert.Single((await Notifications()).Where(x => x.EnrollmentId == 1002));
        using var s = _sp.CreateScope();
        Assert.Equal(1, await s.ServiceProvider.GetRequiredService<NotificationDbContext>().InboxMessages.CountAsync(m => m.MessageId == "dup-evt"));
    }

    [Fact]
    public async Task Poison_message_is_retried_then_moved_to_the_dead_letter_queue_and_good_messages_still_flow()
    {
        using (var ch = _conn.Get().CreateModel())
        {
            var props = ch.CreateBasicProperties(); props.Persistent = true; props.MessageId = "poison";
            ch.BasicPublish(Topology.Exchange, "enrollment.confirmed", props, System.Text.Encoding.UTF8.GetBytes("{this is not json"));
        }
        Publish(Ev("good-after-poison", EventTypes.EnrollmentConfirmed, 1003));
        Assert.NotNull(await Eventually(async () => (await Notifications()).FirstOrDefault(x => x.EnrollmentId == 1003)));   // not blocked by the poison message
        var dead = await Eventually(async () =>
        {
            using var ch = _conn.Get().CreateModel();
            var r = ch.BasicGet(Topology.DeadLetterQueue(Topology.EnrollmentQueue), true);
            return r == null ? null : System.Text.Encoding.UTF8.GetString(r.Body.Span);
        });
        Assert.Equal("{this is not json", dead);
    }

    [Fact]
    public async Task Requested_event_is_acknowledged_without_creating_a_notification()
    {
        Publish(Ev("req-1", EventTypes.EnrollmentRequested, 1004));
        for (var i = 0; i < 40; i++)
        {
            using var s = _sp.CreateScope();
            if (await s.ServiceProvider.GetRequiredService<NotificationDbContext>().InboxMessages.AnyAsync(m => m.MessageId == "req-1")) break;
            await Task.Delay(100);
        }
        Assert.DoesNotContain(await Notifications(), n => n.EnrollmentId == 1004);
    }

    [Fact]
    public void Topology_declares_durable_exchanges_queues_and_dead_letter_queues()
    {
        using var ch = _conn.Get().CreateModel();
        ch.ExchangeDeclarePassive(Topology.Exchange); ch.ExchangeDeclarePassive(Topology.DeadLetterExchange);
        foreach (var q in new[] { Topology.EnrollmentQueue, Topology.CourseQueue, Topology.DeadLetterQueue(Topology.EnrollmentQueue), Topology.DeadLetterQueue(Topology.CourseQueue) })
            ch.QueueDeclarePassive(q);          // throws if the queue does not exist
    }
}

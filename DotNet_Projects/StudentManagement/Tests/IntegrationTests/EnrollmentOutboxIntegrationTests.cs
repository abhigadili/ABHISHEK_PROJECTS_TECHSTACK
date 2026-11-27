using System.Text;
using System.Text.Json;
using EnrollmentService.Data;
using EnrollmentService.Entities;
using EnrollmentService.Outbox;
using EventContracts;
using Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace IntegrationTests;

/// <summary>MySQL + RabbitMQ integration for the enrollment database rules and the transactional outbox.</summary>
[Collection("infra")]
public class EnrollmentOutboxIntegrationTests(InfraFixture infra) : IAsyncLifetime
{
    private string _cs = "";
    private DbContextOptions<EnrollmentDbContext> Opts => new DbContextOptionsBuilder<EnrollmentDbContext>().UseMySql(_cs, new MySqlServerVersion(new Version(8, 0, 36)), o => o.EnableRetryOnFailure(3)).Options;
    public async Task InitializeAsync() { _cs = await infra.NewDatabaseAsync("enrollment"); await using var db = new EnrollmentDbContext(Opts); await db.Database.MigrateAsync(); }
    public Task DisposeAsync() => Task.CompletedTask;

    private static Enrollment E(long student, long course, EnrollmentStatus st, string key) => new() { StudentId = student, CourseId = course, Status = st, IdempotencyKey = key };

    [Fact]
    public async Task Unique_active_key_blocks_a_second_active_enrollment_even_when_the_application_check_is_raced()
    {
        await using var db = new EnrollmentDbContext(Opts);
        db.Enrollments.Add(E(1, 5, EnrollmentStatus.Confirmed, "a")); await db.SaveChangesAsync();
        await using var db2 = new EnrollmentDbContext(Opts);
        db2.Enrollments.Add(E(1, 5, EnrollmentStatus.Pending, "b"));
        await Assert.ThrowsAsync<DbUpdateException>(() => db2.SaveChangesAsync());
    }

    [Fact]
    public async Task Cancelled_or_rejected_rows_do_not_block_a_new_enrollment_and_keys_are_database_generated()
    {
        await using var db = new EnrollmentDbContext(Opts);
        var cancelled = E(2, 5, EnrollmentStatus.Cancelled, "c1"); var rejected = E(2, 5, EnrollmentStatus.Rejected, "c2");
        db.Enrollments.AddRange(cancelled, rejected); await db.SaveChangesAsync();
        db.Enrollments.Add(E(2, 5, EnrollmentStatus.Confirmed, "c3")); await db.SaveChangesAsync();
        await using var check = new EnrollmentDbContext(Opts);
        var active = await check.Enrollments.AsNoTracking().Where(e => e.StudentId == 2).ToListAsync();
        Assert.Equal("2-5", active.Single(e => e.Status == EnrollmentStatus.Confirmed).ActiveKey);
        Assert.All(active.Where(e => e.Status != EnrollmentStatus.Confirmed), e => Assert.Null(e.ActiveKey));
    }

    [Fact]
    public async Task Idempotency_key_is_unique_in_the_database()
    {
        await using var db = new EnrollmentDbContext(Opts);
        db.Enrollments.Add(E(3, 5, EnrollmentStatus.Rejected, "same")); await db.SaveChangesAsync();
        await using var db2 = new EnrollmentDbContext(Opts);
        db2.Enrollments.Add(E(4, 6, EnrollmentStatus.Rejected, "same"));
        await Assert.ThrowsAsync<DbUpdateException>(() => db2.SaveChangesAsync());
    }

    [Fact]
    public async Task Concurrent_saga_starts_with_the_same_key_create_one_row()
    {
        var key = "race-" + Guid.NewGuid().ToString("N")[..8];
        var outcomes = await Task.WhenAll(Enumerable.Range(0, 6).Select(async _ =>
        {
            await using var db = new EnrollmentDbContext(Opts);
            db.Sagas.Add(new SagaInstance { IdempotencyKey = key, StudentId = 1, CourseId = 1 });
            try { await db.SaveChangesAsync(); return true; } catch (DbUpdateException) { return false; }
        }));
        Assert.Equal(1, outcomes.Count(o => o));
    }

    private OutboxPublisher Publisher(IEventPublisher pub, IServiceProvider? sp = null)
        => new(sp?.GetRequiredService<IServiceScopeFactory>() ?? new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), pub,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Outbox:BatchSize"] = "50" }).Build(), NullLogger<OutboxPublisher>.Instance);

    private static OutboxMessage Msg(long aggregate, string type = EventTypes.EnrollmentConfirmed)
    {
        var ev = new EnrollmentEvent(Guid.NewGuid().ToString(), type, aggregate, 1, 5, "Asha", "asha@example.com", "Java", null, "corr-1", DateTimeOffset.UtcNow);
        return new OutboxMessage { EventId = ev.EventId, AggregateId = aggregate, EventType = type, RoutingKey = EventTypes.RoutingKey(type), Payload = JsonSerializer.Serialize(ev, new JsonSerializerOptions(JsonSerializerDefaults.Web)), CorrelationId = "corr-1" };
    }

    [Fact]
    public async Task Outbox_rows_are_published_to_RabbitMQ_as_persistent_messages_and_marked_published()
    {
        var m = Msg(100);
        await using (var db = new EnrollmentDbContext(Opts)) { db.Outbox.Add(m); await db.SaveChangesAsync(); }
        using var conn = new RabbitMqConnection(Options.Create(infra.RabbitOptions));
        using var pub = new RabbitMqEventPublisher(conn, NullLogger<RabbitMqEventPublisher>.Instance);
        await using (var db = new EnrollmentDbContext(Opts)) Assert.Equal(1, await Publisher(pub).PublishBatchAsync(db));

        await using var check = new EnrollmentDbContext(Opts);
        var row = await check.Outbox.AsNoTracking().SingleAsync(o => o.EventId == m.EventId);
        Assert.Equal(OutboxStatus.Published, row.Status); Assert.NotNull(row.PublishedAt);

        using var ch = conn.Get().CreateModel();
        BasicGetResult? got = null;
        for (var i = 0; i < 20 && got == null; i++) { got = ch.BasicGet(Topology.EnrollmentQueue, true); if (got == null) await Task.Delay(100); }
        Assert.NotNull(got);
        Assert.Equal(2, (int)got!.BasicProperties.DeliveryMode);                       // persistent
        Assert.Equal(m.EventId, got.BasicProperties.MessageId);
        Assert.Equal("enrollment.confirmed", got.RoutingKey);
        Assert.Contains(m.EventId, Encoding.UTF8.GetString(got.Body.Span));
    }

    [Fact]
    public async Task Broker_outage_keeps_events_pending_with_backoff_and_a_later_poll_publishes_them()
    {
        var m1 = Msg(200, EventTypes.EnrollmentRequested); var m2 = Msg(200, EventTypes.EnrollmentConfirmed); var other = Msg(201);
        await using (var db = new EnrollmentDbContext(Opts)) { db.Outbox.AddRange(m1, m2, other); await db.SaveChangesAsync(); }

        // 1) broker unreachable (wrong port): nothing is lost
        using var badConn = new RabbitMqConnection(Options.Create(new RabbitMqOptions { HostName = infra.RabbitOptions.HostName, Port = 1, UserName = "x", Password = "y" }));
        using var badPub = new RabbitMqEventPublisher(badConn, NullLogger<RabbitMqEventPublisher>.Instance);
        await using (var db = new EnrollmentDbContext(Opts)) Assert.Equal(0, await Publisher(badPub).PublishBatchAsync(db));
        await using (var check = new EnrollmentDbContext(Opts))
        {
            var rows = await check.Outbox.AsNoTracking().Where(o => o.AggregateId == 200 || o.AggregateId == 201).ToListAsync();
            Assert.All(rows, r => Assert.Equal(OutboxStatus.Pending, r.Status));
            Assert.All(rows.Where(r => r.AggregateId == 200 && r.EventId == m1.EventId), r => { Assert.Equal(1, r.Attempts); Assert.True(r.NextAttemptAt > DateTime.UtcNow); Assert.NotNull(r.LastError); });
            // per-enrollment ordering: after m1 failed, m2 of the same enrollment was NOT attempted in this batch
            Assert.Equal(0, rows.Single(r => r.EventId == m2.EventId).Attempts);
        }

        // 2) the row is not due yet (back-off) → an immediate poll does nothing; make it due, broker back → published in order
        await using (var db = new EnrollmentDbContext(Opts)) await db.Database.ExecuteSqlRawAsync("UPDATE dn_outbox_messages SET NextAttemptAt = UTC_TIMESTAMP(6) - INTERVAL 1 SECOND WHERE AggregateId IN (200, 201)");
        using var conn = new RabbitMqConnection(Options.Create(infra.RabbitOptions));
        using var pub = new RabbitMqEventPublisher(conn, NullLogger<RabbitMqEventPublisher>.Instance);
        await using (var db = new EnrollmentDbContext(Opts)) Assert.Equal(3, await Publisher(pub).PublishBatchAsync(db));
        await using var after = new EnrollmentDbContext(Opts);
        Assert.Equal(3, await after.Outbox.CountAsync(o => (o.AggregateId == 200 || o.AggregateId == 201) && o.Status == OutboxStatus.Published));
    }

    [Fact]
    public async Task Two_publishers_polling_at_once_never_publish_the_same_row_twice()
    {
        var ids = Enumerable.Range(0, 20).Select(i => Msg(300 + i)).ToList();
        await using (var db = new EnrollmentDbContext(Opts)) { db.Outbox.AddRange(ids); await db.SaveChangesAsync(); }
        var published = new System.Collections.Concurrent.ConcurrentBag<string>();
        var fake = new CollectingPublisher(published);
        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(async _ => { await using var db = new EnrollmentDbContext(Opts); return await Publisher(fake).PublishBatchAsync(db); }));
        Assert.Equal(20, published.Count);
        Assert.Equal(20, published.Distinct().Count());                              // FOR UPDATE SKIP LOCKED: no duplicates
        Assert.Equal(20, results.Sum());
    }

    private sealed class CollectingPublisher(System.Collections.Concurrent.ConcurrentBag<string> bag) : IEventPublisher
    {
        public void Publish(string routingKey, string messageId, string eventType, string jsonPayload, string? correlationId = null) { Thread.Sleep(20); bag.Add(messageId); }
    }
}

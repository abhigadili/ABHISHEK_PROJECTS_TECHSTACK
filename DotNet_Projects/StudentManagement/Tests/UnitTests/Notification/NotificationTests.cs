using Common.Errors;
using EventContracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NotificationService.Data;
using NotificationService.Entities;
using NotificationService.Processing;
using NotificationService.Services;

namespace UnitTests.NotificationTests;

public class NotificationTestBase
{
    protected static NotificationDbContext NewDb() => new(new DbContextOptionsBuilder<NotificationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);
    protected static IConfiguration Cfg(params (string, string)[] kv) => new ConfigurationBuilder().AddInMemoryCollection(kv.ToDictionary(x => x.Item1, x => (string?)x.Item2)).Build();
    protected static EnrollmentEvent Ev(string id, string type, long enrollment = 10, string? email = "asha@example.com", string? reason = null)
        => new(id, type, enrollment, 1, 5, "Asha Rao", email, "Java", reason, null, DateTimeOffset.UtcNow);
}

/// <summary>Idempotency of message processing (inbox) and duplicate notification prevention.</summary>
public class NotificationIngestTests : NotificationTestBase
{
    [Fact]
    public async Task Confirmed_event_creates_one_pending_notification_with_readable_text()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(), NullLogger<NotificationIngestService>.Instance);
        Assert.True(await svc.HandleEnrollmentEventAsync(Ev("e1", EventTypes.EnrollmentConfirmed), "q"));
        var n = await db.Notifications.SingleAsync();
        Assert.Equal(NotificationStatus.Pending, n.Status); Assert.Equal(NotificationType.EnrollmentConfirmed, n.NotificationType);
        Assert.Equal("asha@example.com", n.RecipientEmail);
        Assert.Equal("Hi Asha Rao, your enrollment #10 in Java is confirmed.", n.Message);
    }

    [Fact]
    public async Task Redelivered_message_id_is_ignored()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(), NullLogger<NotificationIngestService>.Instance);
        Assert.True(await svc.HandleEnrollmentEventAsync(Ev("same-id", EventTypes.EnrollmentConfirmed), "q"));
        Assert.False(await svc.HandleEnrollmentEventAsync(Ev("same-id", EventTypes.EnrollmentConfirmed), "q"));
        Assert.Equal(1, await db.Notifications.CountAsync()); Assert.Equal(1, await db.InboxMessages.CountAsync());
    }

    [Fact]
    public async Task Different_event_id_for_same_enrollment_and_type_does_not_duplicate_the_notification()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(), NullLogger<NotificationIngestService>.Instance);
        await svc.HandleEnrollmentEventAsync(Ev("a", EventTypes.EnrollmentConfirmed), "q");
        Assert.False(await svc.HandleEnrollmentEventAsync(Ev("b", EventTypes.EnrollmentConfirmed), "q"));
        Assert.Equal(1, await db.Notifications.CountAsync()); Assert.Equal(2, await db.InboxMessages.CountAsync());
    }

    [Fact]
    public async Task Requested_event_is_recorded_in_the_inbox_but_creates_no_notification()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(), NullLogger<NotificationIngestService>.Instance);
        Assert.False(await svc.HandleEnrollmentEventAsync(Ev("r1", EventTypes.EnrollmentRequested), "q"));
        Assert.Equal(0, await db.Notifications.CountAsync()); Assert.Equal(1, await db.InboxMessages.CountAsync());
    }

    [Fact]
    public async Task Rejected_event_message_contains_the_reason()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(), NullLogger<NotificationIngestService>.Instance);
        await svc.HandleEnrollmentEventAsync(Ev("x", EventTypes.EnrollmentRejected, reason: "No seats available"), "q");
        Assert.Contains("rejected: No seats available", (await db.Notifications.SingleAsync()).Message);
    }

    [Fact]
    public async Task Low_availability_event_notifies_the_admin_address()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(("Notification:AdminEmail", "ops@sms.local")), NullLogger<NotificationIngestService>.Instance);
        await svc.HandleLowAvailabilityAsync(new LowCourseAvailabilityEvent("l1", 5, "JV-1", "Java", 3, 30, DateTimeOffset.UtcNow), "q");
        var n = await db.Notifications.SingleAsync();
        Assert.Equal("ops@sms.local", n.RecipientEmail); Assert.Equal(NotificationType.CourseLowAvailability, n.NotificationType);
        Assert.Contains("3 of 30", n.Message);
    }

    [Fact]
    public async Task Unknown_event_type_throws_so_the_broker_retries_then_dead_letters()
    {
        var db = NewDb(); var svc = new NotificationIngestService(db, Cfg(), NullLogger<NotificationIngestService>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.HandleEnrollmentEventAsync(Ev("u", "Bogus"), "q"));
    }
}

public class NotificationProcessorTests : NotificationTestBase
{
    private static Notification N(string? email, int retries = 0) => new() { RecipientEmail = email, Message = "m", NotificationType = NotificationType.EnrollmentConfirmed, RetryCount = retries };
    private static NotificationProcessor P(NotificationDbContext db, int max = 5) => new(db, new EmailSimulator(NullLogger<EmailSimulator>.Instance), Cfg(("Notification:MaxAttempts", max.ToString()), ("Notification:BaseBackoffSeconds", "5")), NullLogger<NotificationProcessor>.Instance);

    [Fact]
    public async Task Successful_send_marks_sent()
    {
        var db = NewDb(); var n = N("ok@example.com"); db.Notifications.Add(n); await db.SaveChangesAsync();
        await P(db).ProcessAsync(n.NotificationId);
        Assert.Equal(NotificationStatus.Sent, n.Status); Assert.NotNull(n.ProcessedAt);
    }

    [Fact]
    public async Task Failure_schedules_exponential_backoff_then_fails_after_max_attempts()
    {
        var db = NewDb(); var n = N("x@fail.test"); db.Notifications.Add(n); await db.SaveChangesAsync();
        var p = P(db, 3);
        await p.ProcessAsync(n.NotificationId);
        Assert.Equal(NotificationStatus.Pending, n.Status); Assert.Equal(1, n.RetryCount);
        Assert.InRange((n.NextAttemptAt!.Value - DateTime.UtcNow).TotalSeconds, 3, 5.5);        // 5 s * 2^0
        await p.ProcessAsync(n.NotificationId);
        Assert.InRange((n.NextAttemptAt!.Value - DateTime.UtcNow).TotalSeconds, 8, 10.5);       // 5 s * 2^1
        await p.ProcessAsync(n.NotificationId);
        Assert.Equal(NotificationStatus.Failed, n.Status); Assert.Equal(3, n.RetryCount);
    }

    [Fact]
    public async Task Missing_recipient_fails_immediately_without_retrying()
    {
        var db = NewDb(); var n = N(null); db.Notifications.Add(n); await db.SaveChangesAsync();
        await P(db).ProcessAsync(n.NotificationId);
        Assert.Equal(NotificationStatus.Failed, n.Status); Assert.Equal(1, n.RetryCount);
    }

    [Fact]
    public async Task Flaky_recipient_succeeds_on_the_third_attempt()
    {
        var db = NewDb(); var n = N("x@flaky.test"); db.Notifications.Add(n); await db.SaveChangesAsync();
        var p = P(db);
        await p.ProcessAsync(n.NotificationId); await p.ProcessAsync(n.NotificationId); await p.ProcessAsync(n.NotificationId);
        Assert.Equal(NotificationStatus.Sent, n.Status);
    }

    [Fact]
    public async Task Only_failed_notifications_can_be_manually_retried()
    {
        var db = NewDb(); var q = new NotificationQueryService(db);
        var pending = N("a@b.c"); var failed = N("a@b.c"); failed.Status = NotificationStatus.Failed; failed.RetryCount = 5;
        db.Notifications.AddRange(pending, failed); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<BusinessRuleException>(() => q.RetryAsync(pending.NotificationId, default));
        var r = await q.RetryAsync(failed.NotificationId, default);
        Assert.Equal(NotificationStatus.Pending, r.Status); Assert.Equal(0, r.RetryCount);
    }
}

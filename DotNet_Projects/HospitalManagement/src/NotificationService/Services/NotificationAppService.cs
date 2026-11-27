using HMS.Notifications.Data;
using HMS.Notifications.Domain;
using HMS.Notifications.Dtos;
using HMS.Shared.Common;
using HMS.Shared.Hosting;
using Microsoft.EntityFrameworkCore;

namespace HMS.Notifications.Services;

public interface INotificationAppService
{
    Task<Notification> QueueAsync(string? email, string? phone, Channel channel, string subject, string message, string eventType, string? referenceId, CancellationToken ct);
    Task<PageResponse<NotificationResponse>> SearchAsync(string? eventType, string? email, int page, int size, CancellationToken ct);
    Task<PageResponse<NotificationResponse>> MineAsync(int page, int size, CancellationToken ct);
    Task<NotificationResponse> GetAsync(long id, CancellationToken ct);
}

/// <summary>Notifications are stored as PENDING by the Kafka handlers and delivered by the hosted <see cref="NotificationDeliveryJob"/>.</summary>
public sealed class NotificationAppService(NotificationDbContext db, ICurrentUser user) : INotificationAppService
{
    public async Task<Notification> QueueAsync(string? email, string? phone, Channel channel, string subject, string message, string eventType, string? referenceId, CancellationToken ct)
    {
        var n = new Notification
        {
            RecipientEmail = string.IsNullOrWhiteSpace(email) ? "unknown" : email, RecipientPhone = phone, Channel = channel, Subject = Truncate(subject, 200),
            Message = Truncate(message, 2000), EventType = eventType, ReferenceId = referenceId
        };
        db.Notifications.Add(n);
        await db.SaveChangesAsync(ct);
        return n;
    }

    public async Task<PageResponse<NotificationResponse>> SearchAsync(string? eventType, string? email, int page, int size, CancellationToken ct)
    {
        size = Math.Clamp(size, 1, 100);
        var q = db.Notifications.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(eventType)) q = q.Where(n => n.EventType == eventType.Trim());
        if (!string.IsNullOrWhiteSpace(email)) { var e = email.Trim().ToLower(); q = q.Where(n => n.RecipientEmail.ToLower() == e); }
        return await PageAsync(q, page, size, ct);
    }

    public async Task<PageResponse<NotificationResponse>> MineAsync(int page, int size, CancellationToken ct)
    {
        var email = user.Email?.ToLower();
        if (email is null) return new PageResponse<NotificationResponse>([], page, size, 0, 0);
        return await PageAsync(db.Notifications.AsNoTracking().Where(n => n.RecipientEmail.ToLower() == email), page, Math.Clamp(size, 1, 100), ct);
    }

    public async Task<NotificationResponse> GetAsync(long id, CancellationToken ct) =>
        NotificationResponse.From(await db.Notifications.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id, ct) ?? throw new NotFoundException($"Notification {id} not found"));

    private static async Task<PageResponse<NotificationResponse>> PageAsync(IQueryable<Notification> q, int page, int size, CancellationToken ct)
    {
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id).Skip(page * size).Take(size).ToListAsync(ct);
        return new PageResponse<NotificationResponse>(rows.Select(NotificationResponse.From).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..(max - 3)] + "...";
}

/// <summary>
/// Hosted delivery worker (PeriodicTimer): picks PENDING notifications and "sends" them. Delivery is simulated - the message is written to the log
/// as an e-mail/SMS gateway would receive it - so a real provider only has to replace <see cref="Deliver"/>. Failures are retried up to Delivery:MaxAttempts.
/// </summary>
public sealed class NotificationDeliveryJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<NotificationDeliveryJob> log)
    : PeriodicJob(scopes, cfg, log, "notification-delivery", "Delivery:IntervalSeconds", 2)
{
    protected override async Task RunAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<NotificationDbContext>();
        var max = cfg.GetValue("Delivery:MaxAttempts", 3);
        var batch = await db.Notifications.Where(n => n.Status == NotificationStatus.PENDING).OrderBy(n => n.Id).Take(50).ToListAsync(ct);
        foreach (var n in batch)
        {
            n.Attempts++;
            try
            {
                Deliver(n);
                n.Status = NotificationStatus.SENT;
                n.SentAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                n.FailureReason = ex.Message.Length > 255 ? ex.Message[..255] : ex.Message;
                if (n.Attempts >= max) n.Status = NotificationStatus.FAILED;
                log.LogWarning("Notification {NotificationId} delivery failed (attempt {Attempt}/{Max}): {Reason}", n.Id, n.Attempts, max, ex.Message);
            }
        }
        if (batch.Count > 0) await db.SaveChangesAsync(ct);
    }

    private void Deliver(Notification n)
    {
        if (string.IsNullOrWhiteSpace(n.RecipientEmail) || n.RecipientEmail == "unknown") throw new InvalidOperationException("No recipient address");
        log.LogInformation("[{Channel} -> {Recipient}] {Subject} | {Message} (event={EventType}, ref={Ref})", n.Channel, n.RecipientEmail, n.Subject, n.Message, n.EventType, n.ReferenceId);
    }
}

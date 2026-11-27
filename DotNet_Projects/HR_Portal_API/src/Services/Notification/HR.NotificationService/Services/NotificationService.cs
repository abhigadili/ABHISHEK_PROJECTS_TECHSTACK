using System.Net;
using System.Net.Mail;
using System.Text.RegularExpressions;
using Confluent.Kafka;
using HR.Common.Cache;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Messaging;
using HR.Common.Security;
using HR.NotificationService.Data;
using HR.NotificationService.DTOs;
using HR.NotificationService.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HR.NotificationService.Services;

public interface INotificationService
{
    Task NotifyAsync(NotifyRequest req, CancellationToken ct);
    Task RecordEventAsync(IntegrationEvent evt, string? employeeId, CancellationToken ct);
    Task<PagedResult<NotificationDto>> MineAsync(NotificationListQuery q, CancellationToken ct);
    Task<UnreadDto> UnreadCountAsync(CancellationToken ct);
    Task<NotificationDto> SetReadAsync(string id, bool read, CancellationToken ct);
    Task<UnreadDto> MarkAllReadAsync(CancellationToken ct);
    Task<PagedResult<DeliveryDto>> DeliveryLogAsync(NotificationListQuery q, CancellationToken ct);
    Task<List<TemplateDto>> ListTemplatesAsync(CancellationToken ct);
    Task<TemplateDto> UpsertTemplateAsync(TemplateRequest r, CancellationToken ct);
    Task<RenderedDto> PreviewAsync(string code, Dictionary<string, string> vars, CancellationToken ct);
    Task<EmailSettingsDto?> GetSettingsAsync(CancellationToken ct);
    Task<EmailSettingsDto?> UpdateSettingsAsync(EmailSettingsRequest r, CancellationToken ct);
    Task<QueuedDto> SendManualAsync(ManualSendRequest r, CancellationToken ct);
    Task<PagedResult<EventHistoryDto>> EventHistoryAsync(HistoryQuery q, CancellationToken ct);
    Task<EventDetailDto> EventDetailAsync(string id, CancellationToken ct);
    List<TopicInfoDto> Topics();
}

public sealed partial class NotificationService(NotificationDbContext db, IRedisService redis, ICurrentUser user, IEventPublisher events, IAuditWriter audit, IOptions<KafkaOptions> kafka,
    IConfiguration cfg, ILogger<NotificationService> log) : INotificationService
{
    [GeneratedRegex(@"\{\{\s*([\w.]+)\s*\}\}")] private static partial Regex Placeholder();
    private int DedupSeconds => cfg.GetValue("Notifications:DedupSeconds", 86400);
    private static readonly System.Text.Json.JsonSerializerOptions PayloadJson = new(System.Text.Json.JsonSerializerDefaults.Web);

    /// <summary>{{name}} placeholders; unknown placeholders render empty.</summary>
    public static string Render(string template, IReadOnlyDictionary<string, string> vars) =>
        Regex.Replace(Placeholder().Replace(template, m => vars.TryGetValue(m.Groups[1].Value, out var v) ? v : ""), @"\s{2,}", " ").Trim();

    // ------------------------------------------------------------------ creating notifications
    /// <summary>Creates the in-app notification and (when enabled) the email, from a template or inline text; de-duplicated through Redis (notification deduplication).</summary>
    public async Task NotifyAsync(NotifyRequest req, CancellationToken ct)
    {
        if (req.DedupKey is not null && !await redis.SetIfAbsentAsync($"notif:{req.DedupKey}", "1", TimeSpan.FromSeconds(DedupSeconds)))
        {
            log.LogInformation("Notification de-duplicated ({Key})", req.DedupKey);
            return;
        }
        var contact = req.RecipientEmployeeId is null ? null : await db.EmployeeContacts.AsNoTracking().FirstOrDefaultAsync(c => c.EmployeeId == req.RecipientEmployeeId, ct);
        var vars = new Dictionary<string, string> { ["name"] = contact?.FullName ?? "" };
        foreach (var kv in req.Variables ?? []) vars[kv.Key] = kv.Value;
        var subject = req.Subject; var body = req.Body;
        if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(body))
        {
            var t = await db.NotificationTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Code == (req.TemplateCode ?? req.Type) && x.Active, ct);
            if (t is null) { log.LogWarning("No template and no inline text for {Type}; notification skipped", req.Type); return; }
            subject = string.IsNullOrEmpty(subject) ? Render(t.SubjectTemplate, vars) : subject;
            body = string.IsNullOrEmpty(body) ? Render(t.BodyTemplate, vars) : body;
        }
        var email = req.RecipientEmail ?? contact?.Email;
        if (req.RecipientEmployeeId is not null && req.Channel is "BOTH" or "IN_APP")
            db.Notifications.Add(new Notification { Type = req.Type, Subject = Cut(subject, 250), Body = Cut(body, 2000), RecipientEmployeeId = req.RecipientEmployeeId, RecipientEmail = email, ReferenceType = req.ReferenceType,
                ReferenceId = req.ReferenceId, CorrelationId = req.CorrelationId ?? CorrelationContext.Id, Channel = "IN_APP", Status = "SENT", SentAt = DateTime.UtcNow });
        if (req.Channel is "BOTH" or "EMAIL") await DeliverEmailAsync(req, subject!, body!, email, ct);
        await db.SaveChangesAsync(ct);
    }

    private static string Cut(string? s, int n) => s is null ? "" : s.Length <= n ? s : s[..n];

    private async Task DeliverEmailAsync(NotifyRequest req, string subject, string body, string? email, CancellationToken ct)
    {
        var s = await db.EmailSettings.AsNoTracking().OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        var status = "SKIPPED"; string? error = null;
        if (email is not null && s is { Enabled: true })
        {
            try
            {
                if (s.Mode == "SMTP")
                {
                    using var client = new SmtpClient(s.Host, s.Port ?? 587) { EnableSsl = s.StartTls, Timeout = 8000 };
                    if (!string.IsNullOrEmpty(s.Username)) client.Credentials = new NetworkCredential(s.Username, cfg["SMTP_PASSWORD"] ?? "");
                    await client.SendMailAsync(new MailMessage(s.FromAddress, email, subject, body), ct);
                }
                else log.LogInformation("Email (LOG mode) to {To}: {Subject}", Regex.Replace(email, @"(^.).*(@.*$)", "$1***$2"), subject);   // recipient masked in logs
                status = "SENT";
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { status = "FAILED"; error = Cut(ex.Message, 250); log.LogError("Email delivery failed: {Error}", ex.GetType().Name); }
        }
        db.Notifications.Add(new Notification { Type = req.Type, Subject = Cut(subject, 250), Body = Cut(body, 2000), RecipientEmployeeId = req.RecipientEmployeeId, RecipientEmail = email, ReferenceType = req.ReferenceType,
            ReferenceId = req.ReferenceId, CorrelationId = req.CorrelationId ?? CorrelationContext.Id, Channel = "EMAIL", Status = status, ErrorMessage = error, SentAt = status == "SENT" ? DateTime.UtcNow : null });
    }

    // ------------------------------------------------------------------ reading (in-app inbox)
    private static NotificationDto ToDto(Notification n) => new(n.Id, n.Type, n.Channel, n.Subject, n.Body, n.Status, n.ReadAt, n.SentAt, n.ReferenceType, n.ReferenceId, n.CreatedAt);

    public async Task<PagedResult<NotificationDto>> MineAsync(NotificationListQuery q, CancellationToken ct)
    {
        var me = user.EmployeeId ?? throw new ForbiddenException("Your account is not linked to an employee");
        var channel = q.Channel ?? "IN_APP";
        var query = db.Notifications.AsNoTracking().Where(n => n.RecipientEmployeeId == me && n.Channel == channel);
        if (q.Unread) query = query.Where(n => n.ReadAt == null);
        if (!string.IsNullOrEmpty(q.Type)) query = query.Where(n => n.Type == q.Type);
        if (!string.IsNullOrWhiteSpace(q.Search)) { var like = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(n => EF.Functions.Like(n.Subject, like) || EF.Functions.Like(n.Body, like)); }
        query = query.OrderByAllowed(q.Sort ?? "CreatedAt", q.Sort is null || q.Descending, ["CreatedAt", "Type", "ReadAt"], "CreatedAt");
        return await query.ToPagedAsync(q, n => new NotificationDto(n.Id, n.Type, n.Channel, n.Subject, n.Body, n.Status, n.ReadAt, n.SentAt, n.ReferenceType, n.ReferenceId, n.CreatedAt), ct);
    }

    public async Task<UnreadDto> UnreadCountAsync(CancellationToken ct) =>
        new(user.EmployeeId is { } me ? await db.Notifications.CountAsync(n => n.RecipientEmployeeId == me && n.Channel == "IN_APP" && n.ReadAt == null, ct) : 0);

    public async Task<NotificationDto> SetReadAsync(string id, bool read, CancellationToken ct)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Notification not found");
        if (n.RecipientEmployeeId != user.EmployeeId) throw new ForbiddenException();
        n.ReadAt = read ? n.ReadAt ?? DateTime.UtcNow : null;
        await db.SaveChangesAsync(ct);
        return ToDto(n);
    }

    public async Task<UnreadDto> MarkAllReadAsync(CancellationToken ct)
    {
        if (user.EmployeeId is { } me)
            await db.Notifications.Where(n => n.RecipientEmployeeId == me && n.Channel == "IN_APP" && n.ReadAt == null).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow), ct);
        return await UnreadCountAsync(ct);
    }

    public async Task<PagedResult<DeliveryDto>> DeliveryLogAsync(NotificationListQuery q, CancellationToken ct)
    {
        var query = db.Notifications.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.Channel)) query = query.Where(n => n.Channel == q.Channel);
        if (!string.IsNullOrEmpty(q.Type)) query = query.Where(n => n.Type == q.Type);
        query = query.OrderByAllowed(q.Sort ?? "CreatedAt", q.Sort is null || q.Descending, ["CreatedAt", "Type", "Status"], "CreatedAt");
        return await query.ToPagedAsync(q, n => new DeliveryDto(n.Id, n.Type, n.Channel, n.Subject, n.Status, n.RecipientEmployeeId, n.RecipientEmail != null ? "***" : null, n.ErrorMessage, n.SentAt, n.CreatedAt), ct);
    }

    // ------------------------------------------------------------------ templates & email settings
    private static TemplateDto ToDto(NotificationTemplate t) => new(t.Id, t.Code, t.SubjectTemplate, t.BodyTemplate, t.Description, t.Active);
    public async Task<List<TemplateDto>> ListTemplatesAsync(CancellationToken ct) => (await db.NotificationTemplates.AsNoTracking().OrderBy(t => t.Code).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<TemplateDto> UpsertTemplateAsync(TemplateRequest r, CancellationToken ct)
    {
        var t = await db.NotificationTemplates.FirstOrDefaultAsync(x => x.Code == r.Code, ct);
        var created = t is null;
        t ??= db.NotificationTemplates.Add(new NotificationTemplate { Code = r.Code }).Entity;
        t.SubjectTemplate = r.SubjectTemplate; t.BodyTemplate = r.BodyTemplate; t.Description = r.Description; t.Active = r.Active;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("NotificationTemplate", r.Code, created ? "CREATED" : "UPDATED");
        return ToDto(t);
    }

    public async Task<RenderedDto> PreviewAsync(string code, Dictionary<string, string> vars, CancellationToken ct)
    {
        var t = await db.NotificationTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code, ct) ?? throw new NotFoundException("Template not found");
        return new RenderedDto(Render(t.SubjectTemplate, vars), Render(t.BodyTemplate, vars));
    }

    private static EmailSettingsDto ToDto(EmailSetting s) => new(s.Id, s.Enabled, s.Mode, s.FromAddress, s.Host, s.Port, s.Username, s.StartTls);   // the SMTP password is never stored or returned
    public async Task<EmailSettingsDto?> GetSettingsAsync(CancellationToken ct) { var s = await db.EmailSettings.AsNoTracking().OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct); return s is null ? null : ToDto(s); }

    public async Task<EmailSettingsDto?> UpdateSettingsAsync(EmailSettingsRequest r, CancellationToken ct)
    {
        var s = await db.EmailSettings.OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (s is null) { s = new EmailSetting(); db.EmailSettings.Add(s); }
        s.Enabled = r.Enabled; s.Mode = r.Mode; s.FromAddress = r.FromAddress; s.Host = r.Host; s.Port = r.Port; s.Username = r.Username; s.StartTls = r.StartTls;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("EmailSettings", "email", "UPDATED", null, new { r.Mode, r.Enabled });
        return ToDto(s);
    }

    /// <summary>Manual broadcast: published through the same event pipeline so delivery is asynchronous.</summary>
    public async Task<QueuedDto> SendManualAsync(ManualSendRequest r, CancellationToken ct)
    {
        foreach (var id in r.EmployeeIds.Distinct())
            events.Publish(HR.Common.Messaging.Topics.NotificationRequested, id, new NotificationRequestedEvent(id, null, "MANUAL_MESSAGE", "BOTH", r.Subject, r.Message, null, null, null, null));
        await db.SaveChangesAsync(ct);
        return new QueuedDto(r.EmployeeIds.Distinct().Count());
    }

    // ------------------------------------------------------------------ business event history
    public async Task RecordEventAsync(IntegrationEvent evt, string? employeeId, CancellationToken ct)
    {
        var ctx = ConsumeContext.Current;
        var payload = System.Text.Json.JsonSerializer.Serialize(evt, evt.GetType(), PayloadJson);
        db.EventHistories.Add(new EventHistory { EventId = evt.EventId, EventType = evt.GetType().Name, Topic = ctx?.Topic ?? "unknown", PartitionNo = ctx?.Partition ?? 0, OffsetNo = ctx?.Offset ?? 0,
            OccurredAt = evt.OccurredAt.UtcDateTime, CorrelationId = evt.CorrelationId, SourceService = "hr-dotnet", EmployeeId = employeeId, Payload = Cut(payload, 16000) });
        await db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<EventHistoryDto>> EventHistoryAsync(HistoryQuery q, CancellationToken ct)
    {
        var query = db.EventHistories.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(q.Topic)) query = query.Where(e => e.Topic == q.Topic);
        if (!string.IsNullOrEmpty(q.EmployeeId)) query = query.Where(e => e.EmployeeId == q.EmployeeId);
        if (!string.IsNullOrEmpty(q.EventType)) query = query.Where(e => e.EventType == q.EventType);
        query = query.OrderByAllowed(q.Sort ?? "OccurredAt", q.Sort is null || q.Descending, ["OccurredAt", "Topic", "EventType"], "OccurredAt");
        return await query.ToPagedAsync(q, e => new EventHistoryDto(e.Id, e.EventId, e.EventType, e.Topic, e.PartitionNo, e.OffsetNo, e.OccurredAt, e.CorrelationId, e.SourceService, e.EmployeeId), ct);
    }

    public async Task<EventDetailDto> EventDetailAsync(string id, CancellationToken ct)
    {
        var e = await db.EventHistories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Event not found");
        return new EventDetailDto(e.Id, e.EventId, e.EventType, e.Topic, e.PartitionNo, e.OffsetNo, e.OccurredAt, e.CorrelationId, e.SourceService, e.EmployeeId, e.Payload);
    }

    /// <summary>Topic information straight from the broker (partitions, leaders, offsets); no dashboards - just data.</summary>
    public List<TopicInfoDto> Topics()
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = kafka.Value.BootstrapServers, SocketTimeoutMs = 5000 }).Build();
        var meta = admin.GetMetadata(TimeSpan.FromSeconds(5));
        using var consumer = new ConsumerBuilder<Ignore, Ignore>(new ConsumerConfig { BootstrapServers = kafka.Value.BootstrapServers, GroupId = "hr-dn-topic-info", EnableAutoCommit = false }).Build();
        var wanted = HR.Common.Messaging.Topics.All.SelectMany(t => new[] { t, HR.Common.Messaging.Topics.Dlt(t) }).ToHashSet();
        return meta.Topics.Where(t => wanted.Contains(t.Topic)).OrderBy(t => t.Topic).Select(t =>
        {
            var parts = t.Partitions.Select(p =>
            {
                var w = consumer.QueryWatermarkOffsets(new TopicPartition(t.Topic, p.PartitionId), TimeSpan.FromSeconds(3));
                return new PartitionInfoDto(p.PartitionId, w.Low.Value, w.High.Value, p.Leader);
            }).ToList();
            return new TopicInfoDto(t.Topic, t.Topic.EndsWith(".DLT"), parts.Count, parts.Sum(p => p.High - p.Low), parts);
        }).ToList();
    }
}

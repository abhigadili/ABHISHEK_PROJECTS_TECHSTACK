using Common.Errors;
using Common.Paging;
using Microsoft.EntityFrameworkCore;
using NotificationService.Data;
using NotificationService.Dtos;
using NotificationService.Entities;

namespace NotificationService.Services;

public class NotificationQueryService(NotificationDbContext db)
{
    public async Task<PagedResult<NotificationResponse>> SearchAsync(long? studentId, NotificationStatus? status, NotificationType? type, int page, int size, CancellationToken ct)
    {
        page = Math.Max(page, 0); size = Math.Min(Math.Max(size, 1), 100);
        IQueryable<Notification> q = db.Notifications.AsNoTracking();
        if (studentId != null) q = q.Where(n => n.StudentId == studentId);
        if (status != null) q = q.Where(n => n.Status == status);
        if (type != null) q = q.Where(n => n.NotificationType == type);
        var total = await q.LongCountAsync(ct);
        var items = await q.OrderByDescending(n => n.NotificationId).Skip(page * size).Take(size).ToListAsync(ct);
        return new PagedResult<NotificationResponse>(items.Select(ToResponse).ToList(), page, size, total, (int)Math.Ceiling(total / (double)size));
    }

    public async Task<NotificationResponse> GetAsync(long id, CancellationToken ct)
        => ToResponse(await db.Notifications.AsNoTracking().FirstOrDefaultAsync(n => n.NotificationId == id, ct) ?? throw new NotFoundException($"Notification {id} not found"));

    /// <summary>Manual retry of a Failed notification.</summary>
    public async Task<NotificationResponse> RetryAsync(long id, CancellationToken ct)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.NotificationId == id, ct) ?? throw new NotFoundException($"Notification {id} not found");
        if (n.Status != NotificationStatus.Failed) throw new BusinessRuleException($"Only Failed notifications can be retried (current: {n.Status})");
        n.Status = NotificationStatus.Pending; n.RetryCount = 0; n.NextAttemptAt = null; n.ProcessedAt = null; n.Version++;
        await db.SaveChangesAsync(ct);
        return ToResponse(n);
    }

    private static NotificationResponse ToResponse(Notification n) => new(n.NotificationId, n.StudentId, n.EnrollmentId, n.NotificationType, n.RecipientEmail,
        n.Message, n.Status, n.RetryCount, n.LastError, n.CreatedAt, n.ProcessedAt);
}

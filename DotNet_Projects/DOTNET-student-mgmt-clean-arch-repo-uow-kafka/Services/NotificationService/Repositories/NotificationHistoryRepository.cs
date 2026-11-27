using Microsoft.EntityFrameworkCore;
using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.NotificationService.Entities;
using StudentMgmt.NotificationService.Repositories.Interfaces;

namespace StudentMgmt.NotificationService.Repositories;

public class NotificationHistoryRepository : RepositoryBase<NotificationHistory>, INotificationHistoryRepository
{
    public NotificationHistoryRepository(DbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<NotificationHistory>> GetByRecipientAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet
            .Where(n => !n.IsDeleted && n.RecipientEmail == email)
            .OrderByDescending(n => n.SentOnUtc)
            .ToListAsync(cancellationToken);
}

using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.NotificationService.Entities;

namespace StudentMgmt.NotificationService.Repositories.Interfaces;

public interface INotificationHistoryRepository : IRepository<NotificationHistory>
{
    Task<IReadOnlyList<NotificationHistory>> GetByRecipientAsync(string email, CancellationToken cancellationToken = default);
}

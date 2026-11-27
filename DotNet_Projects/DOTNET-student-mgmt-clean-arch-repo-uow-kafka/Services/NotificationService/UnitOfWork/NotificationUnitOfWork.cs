using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.NotificationService.Persistence;
using StudentMgmt.NotificationService.Repositories;
using StudentMgmt.NotificationService.Repositories.Interfaces;

namespace StudentMgmt.NotificationService.UnitOfWork;

public class NotificationUnitOfWork : UnitOfWorkBase, INotificationUnitOfWork
{
    public INotificationHistoryRepository NotificationHistories { get; }

    public NotificationUnitOfWork(NotificationDbContext context) : base(context)
    {
        NotificationHistories = new NotificationHistoryRepository(context);
    }
}

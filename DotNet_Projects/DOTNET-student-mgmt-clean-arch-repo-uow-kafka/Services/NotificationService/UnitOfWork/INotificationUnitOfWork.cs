using StudentMgmt.BuildingBlocks.Common.Repositories;
using StudentMgmt.NotificationService.Repositories.Interfaces;

namespace StudentMgmt.NotificationService.UnitOfWork;

public interface INotificationUnitOfWork : IUnitOfWork
{
    INotificationHistoryRepository NotificationHistories { get; }
}

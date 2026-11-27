using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.BuildingBlocks.Contracts.Events;
using StudentMgmt.NotificationService.DTOs.Responses;
using StudentMgmt.NotificationService.Entities;

namespace StudentMgmt.NotificationService.Services.Interfaces;

public interface INotificationAppService
{
    Task<NotificationHistory> DeliverAsync(
        NotificationChannel channel,
        string recipientEmail,
        string? recipientPhoneNumber,
        string subject,
        string body,
        string triggeredByEvent,
        Guid? referenceId,
        CancellationToken cancellationToken = default);

    Task<NotificationHistoryResponse> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PagedResult<NotificationHistoryResponse>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default);
}

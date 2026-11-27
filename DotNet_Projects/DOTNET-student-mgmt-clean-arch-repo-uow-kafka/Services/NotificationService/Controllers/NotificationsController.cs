using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Contracts.Common;
using StudentMgmt.NotificationService.DTOs.Requests;
using StudentMgmt.NotificationService.DTOs.Responses;
using StudentMgmt.NotificationService.Services.Interfaces;

namespace StudentMgmt.NotificationService.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationAppService _notificationAppService;

    public NotificationsController(INotificationAppService notificationAppService)
    {
        _notificationAppService = notificationAppService;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<NotificationHistoryResponse>>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _notificationAppService.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResponse<NotificationHistoryResponse>.Ok(result));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<NotificationHistoryResponse>>>> GetPaged(
        [FromQuery] PagedRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _notificationAppService.GetPagedAsync(request, cancellationToken);
        return Ok(ApiResponse<PagedResult<NotificationHistoryResponse>>.Ok(result));
    }

    [HttpPost("test-send")]
    [Authorize(Policy = PolicyConstants.AdminOnly)]
    public async Task<ActionResult<ApiResponse<NotificationHistoryResponse>>> TestSend(
        [FromBody] SendTestNotificationRequest request,
        CancellationToken cancellationToken)
    {
        var history = await _notificationAppService.DeliverAsync(
            request.Channel,
            request.RecipientEmail,
            request.RecipientPhoneNumber,
            request.Subject,
            request.Body,
            "ManualTestSend",
            null,
            cancellationToken);

        var response = new NotificationHistoryResponse
        {
            Id = history.Id,
            Channel = history.Channel,
            RecipientEmail = history.RecipientEmail,
            RecipientPhoneNumber = history.RecipientPhoneNumber,
            Subject = history.Subject,
            Body = history.Body,
            Success = history.Success,
            FailureReason = history.FailureReason,
            SentOnUtc = history.SentOnUtc,
            TriggeredByEvent = history.TriggeredByEvent,
            ReferenceId = history.ReferenceId
        };

        return Ok(ApiResponse<NotificationHistoryResponse>.Ok(response));
    }
}

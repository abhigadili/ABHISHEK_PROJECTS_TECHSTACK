using Common.Errors;
using Common.Paging;
using Common.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Dtos;
using NotificationService.Entities;
using NotificationService.Services;

namespace NotificationService.Controllers;

/// <summary>Notification history. Notifications are created by RabbitMQ consumers, never by API calls.</summary>
[ApiController, Route("api/notifications"), Authorize, Tags("Notifications")]
public class NotificationsController(NotificationQueryService service) : ControllerBase
{
    /// <summary>Search notification history (paged, newest first) - Admin, Staff.</summary>
    [HttpGet, Authorize(Roles = Roles.AdminOrStaff)]
    public Task<PagedResult<NotificationResponse>> Search([FromQuery] long? studentId, [FromQuery] NotificationStatus? status, [FromQuery] NotificationType? type,
        [FromQuery] int page = 0, [FromQuery] int size = 10, CancellationToken ct = default) => service.SearchAsync(studentId, status, type, page, size, ct);

    /// <summary>Get one notification - Admin, Staff.</summary>
    [HttpGet("{id:long}"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<NotificationResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    /// <summary>Notification history of a student (a Student user: own only).</summary>
    [HttpGet("student/{studentId:long}")]
    public Task<PagedResult<NotificationResponse>> ForStudent(long studentId, [FromQuery] int page = 0, [FromQuery] int size = 10, CancellationToken ct = default)
    {
        if (!User.IsStaffOrAdmin() && User.StudentId() != studentId) throw new ForbiddenException("Students may only read their own notifications");
        return service.SearchAsync(studentId, null, null, page, size, ct);
    }

    /// <summary>Re-queue a Failed notification - Admin, Staff.</summary>
    [HttpPost("{id:long}/retry"), Authorize(Roles = Roles.AdminOrStaff)]
    public Task<NotificationResponse> Retry(long id, CancellationToken ct) => service.RetryAsync(id, ct);
}

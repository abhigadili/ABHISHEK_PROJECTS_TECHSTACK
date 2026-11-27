using HMS.Notifications.Domain;
using HMS.Notifications.Dtos;
using HMS.Notifications.Services;
using HMS.Shared.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Notifications.Controllers;

[ApiController, Authorize, Route("api/notifications")]
public sealed class NotificationsController(INotificationAppService service) : ControllerBase
{
    [HttpGet, Authorize(Roles = "ADMIN")]
    public Task<PageResponse<NotificationResponse>> Search([FromQuery] string? eventType, [FromQuery] string? email, [FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default)
        => service.SearchAsync(eventType, email, page, size, ct);

    /// <summary>Notifications addressed to the e-mail of the logged-in user.</summary>
    [HttpGet("my")]
    public Task<PageResponse<NotificationResponse>> Mine([FromQuery] int page = 0, [FromQuery] int size = 20, CancellationToken ct = default) => service.MineAsync(page, size, ct);

    [HttpGet("{id:long}"), Authorize(Roles = "ADMIN")]
    public Task<NotificationResponse> Get(long id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost("send"), Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Send([FromBody] SendRequest r, CancellationToken ct)
        => StatusCode(201, NotificationResponse.From(await service.QueueAsync(r.RecipientEmail, r.RecipientPhone, Channel.EMAIL, r.Subject, r.Message, "MANUAL", null, ct)));
}

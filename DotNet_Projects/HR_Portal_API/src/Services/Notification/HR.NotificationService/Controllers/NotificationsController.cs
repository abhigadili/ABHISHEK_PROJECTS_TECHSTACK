using Asp.Versioning;
using HR.Common.Common;
using HR.Common.Hosting;
using HR.Common.Security;
using HR.NotificationService.DTOs;
using HR.NotificationService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.NotificationService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/notifications")]
[Authorize]
public sealed class NotificationsController(INotificationService svc) : HrControllerBase
{
    [HttpGet] public async Task<ActionResult<PagedResult<NotificationDto>>> Mine([FromQuery] NotificationListQuery q, CancellationToken ct) => Ok(await svc.MineAsync(q, ct));
    [HttpGet("unread-count")] public async Task<ActionResult<UnreadDto>> Unread(CancellationToken ct) => Ok(await svc.UnreadCountAsync(ct));
    [HttpPost("read-all")] public async Task<ActionResult<UnreadDto>> ReadAll(CancellationToken ct) => Ok(await svc.MarkAllReadAsync(ct));
    [HttpGet("delivery-log"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<PagedResult<DeliveryDto>>> Delivery([FromQuery] NotificationListQuery q, CancellationToken ct) => Ok(await svc.DeliveryLogAsync(q, ct));
    [HttpGet("templates"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<List<TemplateDto>>> Templates(CancellationToken ct) => Ok(await svc.ListTemplatesAsync(ct));
    [HttpPut("templates"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<TemplateDto>> UpsertTemplate(TemplateRequest r, CancellationToken ct) => Ok(await svc.UpsertTemplateAsync(r, ct));
    [HttpPost("templates/{code}/preview"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<RenderedDto>> Preview(string code, PreviewRequest r, CancellationToken ct) => Ok(await svc.PreviewAsync(code, r.Variables ?? [], ct));
    [HttpGet("email-settings"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<EmailSettingsDto?>> Settings(CancellationToken ct) => Ok(await svc.GetSettingsAsync(ct));
    [HttpPut("email-settings"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<EmailSettingsDto?>> UpdateSettings(EmailSettingsRequest r, CancellationToken ct) => Ok(await svc.UpdateSettingsAsync(r, ct));
    [HttpPost("send"), HasPermission(Perm.NotificationManage)] public async Task<ActionResult<QueuedDto>> Send(ManualSendRequest r, CancellationToken ct) => Ok(await svc.SendManualAsync(r, ct));

    [HttpGet("events/history"), HasPermission(Perm.NotificationManage, Perm.AuditView)] public async Task<ActionResult<PagedResult<EventHistoryDto>>> History([FromQuery] HistoryQuery q, CancellationToken ct) => Ok(await svc.EventHistoryAsync(q, ct));
    [HttpGet("events/topics"), HasPermission(Perm.NotificationManage, Perm.AuditView)] public ActionResult<List<TopicInfoDto>> Topics() => Ok(svc.Topics());
    [HttpGet("events/history/{id}"), HasPermission(Perm.NotificationManage, Perm.AuditView)] public async Task<ActionResult<EventDetailDto>> Event(string id, CancellationToken ct) => Ok(await svc.EventDetailAsync(id, ct));

    [HttpPost("{id}/read")] public async Task<ActionResult<NotificationDto>> Read(string id, CancellationToken ct) => Ok(await svc.SetReadAsync(id, true, ct));
    [HttpPost("{id}/unread")] public async Task<ActionResult<NotificationDto>> MarkUnread(string id, CancellationToken ct) => Ok(await svc.SetReadAsync(id, false, ct));
}

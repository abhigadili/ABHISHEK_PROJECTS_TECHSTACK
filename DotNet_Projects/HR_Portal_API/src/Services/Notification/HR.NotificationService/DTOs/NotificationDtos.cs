using System.ComponentModel.DataAnnotations;
using HR.Common.Common;

namespace HR.NotificationService.DTOs;

public sealed class NotificationListQuery : PageQuery
{
    [RegularExpression("^(IN_APP|EMAIL)$")] public string? Channel { get; set; }
    public bool Unread { get; set; }
    public string? Type { get; set; }
}
public sealed class HistoryQuery : PageQuery { public string? Topic { get; set; } public string? EmployeeId { get; set; } public string? EventType { get; set; } }
public sealed record TemplateRequest([Required, StringLength(60, MinimumLength = 2), RegularExpression("^[A-Z0-9_]+$")] string Code, [Required, StringLength(250)] string SubjectTemplate, [Required, StringLength(2000)] string BodyTemplate,
    [StringLength(255)] string? Description, bool Active = true);
public sealed record PreviewRequest(Dictionary<string, string>? Variables);
public sealed record EmailSettingsRequest(bool Enabled, [Required, RegularExpression("^(LOG|SMTP)$")] string Mode, [Required, EmailAddress, StringLength(190)] string FromAddress, [StringLength(190)] string? Host,
    [Range(1, 65535)] int? Port, [StringLength(190)] string? Username, bool StartTls = true);
public sealed record ManualSendRequest([Required, MinLength(1), MaxLength(500)] List<string> EmployeeIds, [Required, StringLength(250, MinimumLength = 3)] string Subject, [Required, StringLength(2000, MinimumLength = 3)] string Message);

public sealed record NotificationDto(string Id, string Type, string Channel, string Subject, string Body, string Status, DateTime? ReadAt, DateTime? SentAt, string? ReferenceType, string? ReferenceId, DateTime CreatedAt);
public sealed record DeliveryDto(string Id, string Type, string Channel, string Subject, string Status, string? RecipientEmployeeId, string? RecipientEmail, string? ErrorMessage, DateTime? SentAt, DateTime CreatedAt);
public sealed record TemplateDto(string Id, string Code, string SubjectTemplate, string BodyTemplate, string? Description, bool Active);
public sealed record RenderedDto(string Subject, string Body);
public sealed record EmailSettingsDto(string Id, bool Enabled, string Mode, string FromAddress, string? Host, int? Port, string? Username, bool StartTls);
public sealed record UnreadDto(int Unread);
public sealed record QueuedDto(int Queued);
public sealed record EventHistoryDto(string Id, string EventId, string? EventType, string Topic, int PartitionNo, long OffsetNo, DateTime OccurredAt, string? CorrelationId, string? SourceService, string? EmployeeId);
public sealed record EventDetailDto(string Id, string EventId, string? EventType, string Topic, int PartitionNo, long OffsetNo, DateTime OccurredAt, string? CorrelationId, string? SourceService, string? EmployeeId, string? Payload);
public sealed record PartitionInfoDto(int Partition, long Low, long High, int Leader);
public sealed record TopicInfoDto(string Topic, bool Dlt, int Partitions, long Messages, List<PartitionInfoDto> PartitionInfo);

public record NotifyRequest
{
    public string Type { get; set; } = "";
    public string? RecipientEmployeeId { get; set; }
    public string? RecipientEmail { get; set; }
    public string? Subject { get; set; }
    public string? Body { get; set; }
    public string? TemplateCode { get; set; }
    public Dictionary<string, string>? Variables { get; set; }
    public string? ReferenceType { get; set; }
    public string? ReferenceId { get; set; }
    public string? DedupKey { get; set; }
    public string? CorrelationId { get; set; }
    public string Channel { get; set; } = "BOTH";
}

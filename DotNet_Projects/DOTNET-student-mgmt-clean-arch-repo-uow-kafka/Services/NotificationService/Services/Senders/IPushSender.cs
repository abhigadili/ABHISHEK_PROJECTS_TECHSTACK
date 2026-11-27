namespace StudentMgmt.NotificationService.Services.Senders;

public interface IPushSender
{
    Task<bool> SendAsync(string recipientId, string subject, string body, CancellationToken cancellationToken = default);
}

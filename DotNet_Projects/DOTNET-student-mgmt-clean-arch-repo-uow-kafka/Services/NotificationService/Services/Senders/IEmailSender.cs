namespace StudentMgmt.NotificationService.Services.Senders;

public interface IEmailSender
{
    Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default);
}

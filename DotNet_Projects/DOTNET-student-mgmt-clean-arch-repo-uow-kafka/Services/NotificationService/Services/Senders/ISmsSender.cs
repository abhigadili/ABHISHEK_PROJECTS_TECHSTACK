namespace StudentMgmt.NotificationService.Services.Senders;

public interface ISmsSender
{
    Task<bool> SendAsync(string toPhoneNumber, string body, CancellationToken cancellationToken = default);
}

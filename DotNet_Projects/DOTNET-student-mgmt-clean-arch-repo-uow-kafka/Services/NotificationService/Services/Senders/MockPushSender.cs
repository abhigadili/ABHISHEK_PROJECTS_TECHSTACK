using Microsoft.Extensions.Logging;

namespace StudentMgmt.NotificationService.Services.Senders;

/// <summary>
/// Mock push notification sender. Logs a convincing delivery line and always
/// reports success, matching the mock behavior of the other channels.
/// </summary>
public class MockPushSender : IPushSender
{
    private readonly ILogger<MockPushSender> _logger;

    public MockPushSender(ILogger<MockPushSender> logger)
    {
        _logger = logger;
    }

    public Task<bool> SendAsync(string recipientId, string subject, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[MOCK PUSH] To: {recipientId} | Subject: {subject}", recipientId, subject);
        return Task.FromResult(true);
    }
}

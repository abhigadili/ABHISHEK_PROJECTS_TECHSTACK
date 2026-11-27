using Microsoft.Extensions.Logging;

namespace StudentMgmt.NotificationService.Services.Senders;

/// <summary>
/// Mock SMS sender. Simulates a realistic failure path: a missing/blank phone
/// number cannot be delivered to, so it returns false instead of always
/// succeeding — this lets NotificationAppService persist a genuinely failed
/// NotificationHistory row rather than only ever recording successes.
/// </summary>
public class MockSmsSender : ISmsSender
{
    private readonly ILogger<MockSmsSender> _logger;

    public MockSmsSender(ILogger<MockSmsSender> logger)
    {
        _logger = logger;
    }

    public Task<bool> SendAsync(string toPhoneNumber, string body, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(toPhoneNumber))
        {
            _logger.LogWarning("[MOCK SMS] Cannot deliver: no phone number supplied.");
            return Task.FromResult(false);
        }

        _logger.LogInformation("[MOCK SMS] To: {toPhoneNumber} | Body: {body}", toPhoneNumber, body);
        return Task.FromResult(true);
    }
}

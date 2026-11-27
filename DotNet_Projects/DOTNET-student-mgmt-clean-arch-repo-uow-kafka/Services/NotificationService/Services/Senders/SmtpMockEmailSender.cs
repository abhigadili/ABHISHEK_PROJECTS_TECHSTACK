using Microsoft.Extensions.Logging;

namespace StudentMgmt.NotificationService.Services.Senders;

/// <summary>
/// Mock email sender. NotificationService intentionally does not integrate with a
/// real SMTP server (per spec, email/SMS/push are all mocked) — it logs a
/// convincing delivery line and always reports success, which is sufficient to
/// exercise the full history/Kafka-outcome pipeline without external dependencies.
/// </summary>
public class SmtpMockEmailSender : IEmailSender
{
    private readonly ILogger<SmtpMockEmailSender> _logger;

    public SmtpMockEmailSender(ILogger<SmtpMockEmailSender> logger)
    {
        _logger = logger;
    }

    public Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[MOCK EMAIL] To: {toEmail} | Subject: {subject}", toEmail, subject);
        return Task.FromResult(true);
    }
}

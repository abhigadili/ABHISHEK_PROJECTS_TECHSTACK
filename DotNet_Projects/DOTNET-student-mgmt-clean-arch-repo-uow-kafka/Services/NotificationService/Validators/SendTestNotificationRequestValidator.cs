using FluentValidation;
using StudentMgmt.NotificationService.DTOs.Requests;

namespace StudentMgmt.NotificationService.Validators;

public class SendTestNotificationRequestValidator : AbstractValidator<SendTestNotificationRequest>
{
    public SendTestNotificationRequestValidator()
    {
        RuleFor(x => x.RecipientEmail)
            .NotEmpty().WithMessage("RecipientEmail is required.")
            .EmailAddress().WithMessage("RecipientEmail must be a valid email address.");

        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("Subject is required.");

        RuleFor(x => x.Body)
            .NotEmpty().WithMessage("Body is required.");

        RuleFor(x => x.Channel)
            .IsInEnum().WithMessage("Channel must be a valid notification channel.");
    }
}

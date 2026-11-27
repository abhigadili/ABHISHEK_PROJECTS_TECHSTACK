using FluentValidation;
using HR.AuthService.DTOs;

namespace HR.AuthService.Validators;

/// <summary>Central password policy (also used by the services): 8-128 chars, upper + lower + digit + special.</summary>
public static class PasswordPolicy
{
    public static IRuleBuilderOptions<T, string> Strong<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().MinimumLength(8).MaximumLength(128)
            .Matches("[A-Z]").WithMessage("must contain an upper-case letter")
            .Matches("[a-z]").WithMessage("must contain a lower-case letter")
            .Matches("[0-9]").WithMessage("must contain a digit")
            .Matches("[^A-Za-z0-9]").WithMessage("must contain a special character");
}

public sealed class CreateUserValidator : AbstractValidator<CreateUserRequest> { public CreateUserValidator() => RuleFor(x => x.Password).Strong(); }
public sealed class ChangePasswordValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordValidator()
    {
        RuleFor(x => x.NewPassword).Strong();
        RuleFor(x => x.NewPassword).NotEqual(x => x.CurrentPassword).WithMessage("must differ from the current password");
    }
}
public sealed class ResetPasswordValidator : AbstractValidator<ResetPasswordRequest> { public ResetPasswordValidator() => RuleFor(x => x.NewPassword).Strong(); }
public sealed class AdminResetPasswordValidator : AbstractValidator<AdminResetPasswordRequest> { public AdminResetPasswordValidator() => RuleFor(x => x.NewPassword).Strong(); }

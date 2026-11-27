using FluentValidation;
using StudentMgmt.StudentService.DTOs.Requests;

namespace StudentMgmt.StudentService.Validators;

public class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

using FluentValidation;
using StudentMgmt.StudentService.DTOs.Requests;

namespace StudentMgmt.StudentService.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

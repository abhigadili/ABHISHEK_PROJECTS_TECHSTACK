using FluentValidation;
using StudentMgmt.StudentService.DTOs.Requests;

namespace StudentMgmt.StudentService.Validators;

public class UpdateStudentRequestValidator : AbstractValidator<UpdateStudentRequest>
{
    public UpdateStudentRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.PhoneNumber).MaximumLength(30).When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
        RuleFor(x => x.DateOfBirth).LessThan(DateTime.UtcNow).WithMessage("Date of birth must be in the past.");
        RuleFor(x => x.Address).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.Address));
    }
}

using FluentValidation;
using StudentMgmt.EnrollmentService.DTOs.Requests;

namespace StudentMgmt.EnrollmentService.Validators;

public class EnrollStudentRequestValidator : AbstractValidator<EnrollStudentRequest>
{
    public EnrollStudentRequestValidator()
    {
        RuleFor(x => x.StudentId).NotEmpty();
        RuleFor(x => x.CourseId).NotEmpty();
    }
}

public class CancelEnrollmentRequestValidator : AbstractValidator<CancelEnrollmentRequest>
{
    public CancelEnrollmentRequestValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty()
            .MaximumLength(500);
    }
}

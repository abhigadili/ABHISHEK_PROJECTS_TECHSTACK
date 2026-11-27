using FluentValidation;
using StudentMgmt.CourseService.DTOs.Requests;

namespace StudentMgmt.CourseService.Validators;

public class CreateCourseRequestValidator : AbstractValidator<CreateCourseRequest>
{
    public CreateCourseRequestValidator()
    {
        RuleFor(x => x.CourseCode)
            .NotEmpty().WithMessage("Course code is required.")
            .MaximumLength(10).WithMessage("Course code must not exceed 10 characters.")
            .Matches("^[A-Z]{2,6}\\d{2,4}$").WithMessage("Course code must look like 'CS101' (2-6 uppercase letters followed by 2-4 digits).");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200).WithMessage("Title must not exceed 200 characters.");

        RuleFor(x => x.Description)
            .NotNull().WithMessage("Description is required.")
            .MaximumLength(2000).WithMessage("Description must not exceed 2000 characters.");

        RuleFor(x => x.Credits)
            .InclusiveBetween(1, 6).WithMessage("Credits must be between 1 and 6.");

        RuleFor(x => x.Capacity)
            .InclusiveBetween(1, 500).WithMessage("Capacity must be between 1 and 500.");

        RuleFor(x => x.InstructorName)
            .NotEmpty().WithMessage("Instructor name is required.")
            .MaximumLength(200).WithMessage("Instructor name must not exceed 200 characters.");
    }
}

public class UpdateCourseRequestValidator : AbstractValidator<UpdateCourseRequest>
{
    public UpdateCourseRequestValidator()
    {
        RuleFor(x => x.CourseCode)
            .NotEmpty().WithMessage("Course code is required.")
            .MaximumLength(10).WithMessage("Course code must not exceed 10 characters.")
            .Matches("^[A-Z]{2,6}\\d{2,4}$").WithMessage("Course code must look like 'CS101' (2-6 uppercase letters followed by 2-4 digits).");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200).WithMessage("Title must not exceed 200 characters.");

        RuleFor(x => x.Description)
            .NotNull().WithMessage("Description is required.")
            .MaximumLength(2000).WithMessage("Description must not exceed 2000 characters.");

        RuleFor(x => x.Credits)
            .InclusiveBetween(1, 6).WithMessage("Credits must be between 1 and 6.");

        RuleFor(x => x.Capacity)
            .InclusiveBetween(1, 500).WithMessage("Capacity must be between 1 and 500.");

        RuleFor(x => x.InstructorName)
            .NotEmpty().WithMessage("Instructor name is required.")
            .MaximumLength(200).WithMessage("Instructor name must not exceed 200 characters.");
    }
}

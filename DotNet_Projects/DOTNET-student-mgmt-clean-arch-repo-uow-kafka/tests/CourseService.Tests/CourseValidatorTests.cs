using FluentAssertions;
using FluentValidation.TestHelper;
using StudentMgmt.CourseService.DTOs.Requests;
using StudentMgmt.CourseService.Validators;
using Xunit;

namespace StudentMgmt.CourseService.Tests;

public class CourseValidatorTests
{
    private readonly CreateCourseRequestValidator _createValidator = new();
    private readonly UpdateCourseRequestValidator _updateValidator = new();

    private static CreateCourseRequest ValidCreateRequest() => new()
    {
        CourseCode = "CS101",
        Title = "Introduction to Computer Science",
        Description = "A foundational course covering programming basics.",
        Credits = 3,
        Capacity = 30,
        InstructorName = "Dr. Ada Lovelace"
    };

    [Fact]
    public void CreateValidator_AcceptsValidRequest()
    {
        var result = _createValidator.TestValidate(ValidCreateRequest());

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateValidator_RejectsEmptyTitle()
    {
        var request = ValidCreateRequest();
        request.Title = string.Empty;

        var result = _createValidator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Title);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(7)]
    [InlineData(-1)]
    public void CreateValidator_RejectsCreditsOutsideOneToSix(int credits)
    {
        var request = ValidCreateRequest();
        request.Credits = credits;

        var result = _createValidator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Credits);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(501)]
    [InlineData(-5)]
    public void CreateValidator_RejectsCapacityOutsideOneToFiveHundred(int capacity)
    {
        var request = ValidCreateRequest();
        request.Capacity = capacity;

        var result = _createValidator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Capacity);
    }

    [Theory]
    [InlineData("cs101")]
    [InlineData("101CS")]
    [InlineData("C1")]
    [InlineData("")]
    [InlineData("TOOLONGCODE1234")]
    public void CreateValidator_RejectsMalformedCourseCode(string courseCode)
    {
        var request = ValidCreateRequest();
        request.CourseCode = courseCode;

        var result = _createValidator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.CourseCode);
    }

    [Theory]
    [InlineData("CS101")]
    [InlineData("MATH2010")]
    [InlineData("AB99")]
    public void CreateValidator_AcceptsWellFormedCourseCode(string courseCode)
    {
        var request = ValidCreateRequest();
        request.CourseCode = courseCode;

        var result = _createValidator.TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(r => r.CourseCode);
    }

    [Fact]
    public void CreateValidator_RejectsEmptyInstructorName()
    {
        var request = ValidCreateRequest();
        request.InstructorName = string.Empty;

        var result = _createValidator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.InstructorName);
    }

    [Fact]
    public void UpdateValidator_AcceptsValidRequest()
    {
        var request = new UpdateCourseRequest
        {
            CourseCode = "CS101",
            Title = "Introduction to Computer Science",
            Description = "A foundational course covering programming basics.",
            Credits = 3,
            Capacity = 30,
            InstructorName = "Dr. Ada Lovelace"
        };

        var result = _updateValidator.TestValidate(request);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateValidator_RejectsInvalidCourseCodeAndZeroCreditsAndZeroCapacity()
    {
        var request = new UpdateCourseRequest
        {
            CourseCode = "invalid-code",
            Title = "Some Title",
            Description = "Some description.",
            Credits = 0,
            Capacity = 0,
            InstructorName = "Dr. Ada Lovelace"
        };

        var result = _updateValidator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.CourseCode);
        result.ShouldHaveValidationErrorFor(r => r.Credits);
        result.ShouldHaveValidationErrorFor(r => r.Capacity);
    }
}

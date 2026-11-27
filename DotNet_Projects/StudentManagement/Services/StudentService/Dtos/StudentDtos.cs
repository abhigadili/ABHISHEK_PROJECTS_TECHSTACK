using System.ComponentModel.DataAnnotations;
using StudentService.Entities;
using StudentService.Validation;

namespace StudentService.Dtos;

public record StudentRequest(
    [Required, StringLength(50)] string FirstName,
    [Required, StringLength(50)] string LastName,
    [Required, EmailAddress, StringLength(100)] string Email,
    [OptionalPhone] string? PhoneNumber,
    DateOnly? DateOfBirth,
    Gender? Gender,
    [StringLength(255)] string? Address,
    DateOnly? EnrollmentDate,
    StudentStatus? Status);

public record StudentResponse(long StudentId, string FirstName, string LastName, string Email, string? PhoneNumber, DateOnly? DateOfBirth,
    Gender? Gender, string? Address, DateOnly EnrollmentDate, StudentStatus Status, DateTime CreatedAt, DateTime UpdatedAt);

public record StatusUpdateRequest([Required] StudentStatus? Status);
public record EligibilityResponse(long StudentId, bool Eligible, string? Reason);

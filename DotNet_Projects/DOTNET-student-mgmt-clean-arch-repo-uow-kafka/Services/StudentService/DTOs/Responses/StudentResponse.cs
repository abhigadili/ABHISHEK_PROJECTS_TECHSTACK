namespace StudentMgmt.StudentService.DTOs.Responses;

public class StudentResponse
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string? Address { get; set; }
    public string EnrollmentNumber { get; set; } = default!;
    public Guid? UserId { get; set; }
    public DateTime CreatedDate { get; set; }
}

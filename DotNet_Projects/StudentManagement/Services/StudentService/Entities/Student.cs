namespace StudentService.Entities;

public enum Gender { Male, Female, Other }
public enum StudentStatus { Active, Inactive }

public class Student
{
    public long StudentId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? PhoneNumber { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public Gender? Gender { get; set; }
    public string? Address { get; set; }
    public DateOnly EnrollmentDate { get; set; }
    public StudentStatus Status { get; set; } = StudentStatus.Active;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

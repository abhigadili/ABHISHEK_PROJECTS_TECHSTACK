namespace StudentMgmt.StudentService.DTOs.Requests;

public class RegisterRequest
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string Password { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public DateTime? DateOfBirth { get; set; }

    /// <summary>Defaults to "Student" server-side when null/empty.</summary>
    public string? Role { get; set; }
}

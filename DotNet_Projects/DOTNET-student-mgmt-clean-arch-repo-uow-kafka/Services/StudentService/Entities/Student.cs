using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.StudentService.Entities;

/// <summary>
/// A student record. May optionally be linked to an <see cref="ApplicationUser"/>
/// login (via <see cref="UserId"/>) — nullable because a Student record could in
/// principle exist without a login, though the Register flow always creates both
/// together for Student-role registrations.
/// </summary>
public class Student : BaseEntity
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string? Address { get; set; }
    public string EnrollmentNumber { get; set; } = default!;
    public Guid? UserId { get; set; }
}

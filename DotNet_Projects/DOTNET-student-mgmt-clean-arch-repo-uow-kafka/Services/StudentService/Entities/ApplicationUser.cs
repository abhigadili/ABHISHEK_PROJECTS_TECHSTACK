using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.StudentService.Entities;

/// <summary>A login account. StudentService is the identity owner for the whole system.</summary>
public class ApplicationUser : BaseEntity
{
    public string FullName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
}

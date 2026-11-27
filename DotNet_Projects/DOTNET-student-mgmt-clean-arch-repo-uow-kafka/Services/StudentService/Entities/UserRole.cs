using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.StudentService.Entities;

/// <summary>Many-to-many join entity between <see cref="ApplicationUser"/> and <see cref="Role"/>.</summary>
public class UserRole : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
}

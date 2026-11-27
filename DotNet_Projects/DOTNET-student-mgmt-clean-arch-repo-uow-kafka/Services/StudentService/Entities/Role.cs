using StudentMgmt.BuildingBlocks.Common.Entities;

namespace StudentMgmt.StudentService.Entities;

/// <summary>A named role (Admin/Faculty/Student) — see RoleConstants.All for the seeded set.</summary>
public class Role : BaseEntity
{
    public string Name { get; set; } = default!;
}

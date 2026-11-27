namespace StudentMgmt.BuildingBlocks.Common.Constants;

public static class RoleConstants
{
    public const string Admin = "Admin";
    public const string Faculty = "Faculty";
    public const string Student = "Student";

    public static readonly string[] All = { Admin, Faculty, Student };
}

/// <summary>
/// Named authorization policies registered identically in every service's
/// Program.cs (see <c>AuthorizationServiceExtensions.AddAppAuthorization</c>) so
/// controllers can use <c>[Authorize(Policy = PolicyConstants.CanManageCourses)]</c>
/// instead of scattering raw role-name strings across every controller.
/// </summary>
public static class PolicyConstants
{
    public const string AdminOnly = "AdminOnly";
    public const string CanManageCourses = "CanManageCourses";
    public const string CanManageStudents = "CanManageStudents";
    public const string CanEnroll = "CanEnroll";
}

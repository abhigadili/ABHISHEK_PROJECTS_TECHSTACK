namespace Common.Security;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Staff = "Staff";
    public const string Student = "Student";
    /// <summary>Internal role carried by short-lived tokens that one service uses to call another.</summary>
    public const string Service = "Service";
    public const string AdminOrStaff = "Admin,Staff";
    public const string AdminStaffService = "Admin,Staff,Service";
    public const string AdminOrService = "Admin,Service";
    public const string AllUsers = "Admin,Staff,Student";
}

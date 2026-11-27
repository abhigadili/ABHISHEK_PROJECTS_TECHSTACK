using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace HR.Common.Security;

/// <summary>Read-only view of the authenticated caller (SecurityContext) taken from the validated JWT claims.</summary>
public interface ICurrentUser
{
    string? UserId { get; }
    string? Username { get; }
    string? EmployeeId { get; }
    string? Token { get; }
    IReadOnlyCollection<string> Roles { get; }
    IReadOnlyCollection<string> Permissions { get; }
    bool IsAuthenticated { get; }
    bool HasPermission(string permission);
    bool HasAnyPermission(params string[] permissions);
    bool IsInRole(string role);
    bool IsSuperAdmin { get; }
    /// <summary>Throws ForbiddenException unless the caller is the employee itself or holds one of the permissions.</summary>
    void EnsureSelfOr(string? employeeId, params string[] permissions);
}

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? P => accessor.HttpContext?.User;
    public bool IsAuthenticated => P?.Identity?.IsAuthenticated ?? false;
    public string? UserId => P?.FindFirstValue("sub");
    public string? Username => P?.FindFirstValue("unique_name");
    public string? EmployeeId => P?.FindFirstValue("eid");
    public string? Token
    {
        get
        {
            var h = accessor.HttpContext?.Request.Headers.Authorization.ToString();
            return !string.IsNullOrEmpty(h) && h.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? h[7..] : null;
        }
    }
    public IReadOnlyCollection<string> Roles => P?.FindAll("role").Select(c => c.Value).ToArray() ?? [];
    public IReadOnlyCollection<string> Permissions => P?.FindAll("perm").Select(c => c.Value).ToArray() ?? [];
    public bool HasPermission(string permission) => P?.HasClaim("perm", permission) ?? false;
    public bool HasAnyPermission(params string[] permissions) => permissions.Any(HasPermission);
    public bool IsInRole(string role) => P?.IsInRole(role) ?? false;
    public bool IsSuperAdmin => IsInRole(Security.Roles.SuperAdmin);
    public void EnsureSelfOr(string? employeeId, params string[] permissions)
    {
        if (employeeId is not null && string.Equals(EmployeeId, employeeId, StringComparison.OrdinalIgnoreCase)) return;
        if (IsSuperAdmin || HasAnyPermission(permissions)) return;
        throw new Common.ForbiddenException();
    }
}

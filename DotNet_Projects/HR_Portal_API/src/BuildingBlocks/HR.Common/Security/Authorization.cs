using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace HR.Common.Security;

/// <summary>Policy requirement: the JWT must carry at least one of the permission claims (SUPER_ADMIN always passes).</summary>
public sealed class PermissionRequirement(string[] permissions) : IAuthorizationRequirement
{
    public string[] Permissions { get; } = permissions;
}

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.IsInRole(Roles.SuperAdmin) || requirement.Permissions.Any(p => context.User.HasClaim("perm", p)))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

/// <summary>Builds policies on demand from the policy name: "perm:LEAVE_APPROVE,TEAM_VIEW" (any of) or "role:HR_ADMIN,MANAGER".</summary>
public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public const string PermPrefix = "perm:", RolePrefix = "role:";

    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(PermPrefix, StringComparison.Ordinal))
            return new AuthorizationPolicyBuilder().RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(policyName[PermPrefix.Length..].Split(',', StringSplitOptions.RemoveEmptyEntries))).Build();
        if (policyName.StartsWith(RolePrefix, StringComparison.Ordinal))
            return new AuthorizationPolicyBuilder().RequireAuthenticatedUser()
                .RequireRole(policyName[RolePrefix.Length..].Split(',', StringSplitOptions.RemoveEmptyEntries).Append(Roles.SuperAdmin).ToArray()).Build();
        return await base.GetPolicyAsync(policyName);
    }
}

/// <summary>[HasPermission(Perm.LeaveApprove, Perm.TeamView)] - passes when the caller holds ANY of the permissions.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public HasPermissionAttribute(params string[] permissions) => Policy = PermissionPolicyProvider.PermPrefix + string.Join(',', permissions);
}

/// <summary>[RequireRole(Roles.HrAdmin)] - role policy (SUPER_ADMIN always passes).</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireRoleAttribute : AuthorizeAttribute
{
    public RequireRoleAttribute(params string[] roles) => Policy = PermissionPolicyProvider.RolePrefix + string.Join(',', roles);
}

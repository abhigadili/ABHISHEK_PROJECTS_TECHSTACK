using Asp.Versioning;
using HR.AuthService.DTOs;
using HR.AuthService.Services;
using HR.Common.Common;
using HR.Common.Data;
using HR.Common.Hosting;
using HR.Common.Security;
using Microsoft.AspNetCore.Mvc;

namespace HR.AuthService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
[HasPermission(Perm.UserManage)]
public sealed class UsersController(IUserService users) : HrControllerBase
{
    [HttpGet("users")]
    public async Task<ActionResult<PagedResult<UserDto>>> List([FromQuery] UserListQuery q, CancellationToken ct) => Ok(await users.ListAsync(q, ct));

    [HttpPost("users"), Idempotent]
    public async Task<IActionResult> Create(CreateUserRequest req, CancellationToken ct)
    {
        var u = await users.CreateAsync(req, ct);
        return CreatedAtAction(nameof(Get), new { id = u.Id, version = "1" }, u);
    }

    [HttpGet("users/{id}")]
    public async Task<ActionResult<UserDto>> Get(string id, CancellationToken ct) => Ok(await users.GetAsync(id, ct));

    [HttpPatch("users/{id}")]
    public async Task<ActionResult<UserDto>> Update(string id, UpdateUserRequest req, CancellationToken ct) => Ok(await users.UpdateAsync(id, req, ct));

    [HttpPut("users/{id}/roles")]
    public async Task<ActionResult<UserDto>> AssignRoles(string id, AssignRolesRequest req, CancellationToken ct) => Ok(await users.AssignRolesAsync(id, req.Roles, ct));

    [HttpPost("users/{id}/activate")]
    public async Task<ActionResult<UserDto>> Activate(string id, CancellationToken ct) => Ok(await users.SetStatusAsync(id, "ACTIVE", ct));

    [HttpPost("users/{id}/deactivate")]
    public async Task<ActionResult<UserDto>> Deactivate(string id, CancellationToken ct) => Ok(await users.SetStatusAsync(id, "INACTIVE", ct));

    [HttpPost("users/{id}/unlock")]
    public async Task<ActionResult<UserDto>> Unlock(string id, CancellationToken ct) => Ok(await users.UnlockAsync(id, ct));

    [HttpPut("users/{id}/employee")]
    public async Task<ActionResult<UserDto>> Link(string id, LinkEmployeeRequest req, CancellationToken ct) => Ok(await users.LinkEmployeeAsync(id, req.EmployeeId, ct));

    [HttpPost("users/{id}/password-reset")]
    public async Task<IActionResult> AdminReset(string id, AdminResetPasswordRequest req, CancellationToken ct) { await users.AdminResetPasswordAsync(id, req.NewPassword, ct); return NoContent(); }

    [HttpGet("users/{id}/history")]
    public async Task<ActionResult<List<AuditRecord>>> History(string id, CancellationToken ct) => Ok(await users.HistoryAsync(id, ct));

    [HttpGet("roles")]
    public async Task<ActionResult<List<RoleDto>>> Roles(CancellationToken ct) => Ok(await users.ListRolesAsync(ct));

    [HttpPut("roles/{id}/permissions")]
    public async Task<ActionResult<RoleDto>> SetPermissions(string id, SetRolePermissionsRequest req, CancellationToken ct) => Ok(await users.SetRolePermissionsAsync(id, req.Permissions, ct));

    [HttpGet("permissions")]
    public async Task<ActionResult<List<PermissionDto>>> Permissions(CancellationToken ct) => Ok(await users.ListPermissionsAsync(ct));
}

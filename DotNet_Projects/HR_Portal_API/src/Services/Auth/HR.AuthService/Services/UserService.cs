using HR.AuthService.Data;
using HR.AuthService.DTOs;
using HR.AuthService.Entities;
using HR.Common.Common;
using HR.Common.Data;
using Microsoft.EntityFrameworkCore;

namespace HR.AuthService.Services;

public interface IUserService
{
    Task<PagedResult<UserDto>> ListAsync(UserListQuery q, CancellationToken ct);
    Task<UserDto> GetAsync(string id, CancellationToken ct);
    Task<UserDto> CreateAsync(CreateUserRequest req, CancellationToken ct);
    Task<UserDto> UpdateAsync(string id, UpdateUserRequest req, CancellationToken ct);
    Task<UserDto> AssignRolesAsync(string id, List<string> roles, CancellationToken ct);
    Task<UserDto> SetStatusAsync(string id, string status, CancellationToken ct);
    Task<UserDto> UnlockAsync(string id, CancellationToken ct);
    Task<UserDto> LinkEmployeeAsync(string id, string employeeId, CancellationToken ct);
    Task AdminResetPasswordAsync(string id, string newPassword, CancellationToken ct);
    Task<List<AuditRecord>> HistoryAsync(string id, CancellationToken ct);
    Task<List<RoleDto>> ListRolesAsync(CancellationToken ct);
    Task<List<PermissionDto>> ListPermissionsAsync(CancellationToken ct);
    Task<RoleDto> SetRolePermissionsAsync(string roleId, List<string> codes, CancellationToken ct);
    Task DeactivateByEmployeeAsync(string employeeId, CancellationToken ct);
}

public sealed class UserService(AuthDbContext db, IAuthService auth, IAuditWriter audit, IUnitOfWork uow) : IUserService
{
    private static readonly string[] SortFields = ["Username", "Email", "Status", "CreatedAt", "LastLoginAt"];

    internal static UserDto ToDto(UserAccount u) => new(u.Id, u.Username, u.Email, u.EmployeeId, u.Status, u.MustChangePassword, u.LastLoginAt, u.LockedUntil, u.PasswordChangedAt, u.CreatedAt,
        u.Roles.Select(r => r.Name).OrderBy(n => n).ToList(), u.Roles.SelectMany(r => r.Permissions).Select(p => p.Code).Distinct().OrderBy(c => c).ToList());

    private IQueryable<UserAccount> WithRoles => db.UserAccounts.Include(u => u.Roles).ThenInclude(r => r.Permissions);

    public async Task<PagedResult<UserDto>> ListAsync(UserListQuery q, CancellationToken ct)
    {
        var query = db.UserAccounts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Search)) { var s = $"%{q.Search.Trim().EscapeLike()}%"; query = query.Where(u => EF.Functions.Like(u.Username, s) || EF.Functions.Like(u.Email, s)); }
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(u => u.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Role)) query = query.Where(u => u.Roles.Any(r => r.Name == q.Role));
        query = query.OrderByAllowed(q.Sort, q.Descending, SortFields, "Username");
        var total = await query.LongCountAsync(ct);
        var rows = await query.Skip((q.Page - 1) * q.Size).Take(q.Size).Include(u => u.Roles).ThenInclude(r => r.Permissions).AsSplitQuery().ToListAsync(ct);
        return PagedResult<UserDto>.Of(rows.Select(ToDto).ToList(), q.Page, q.Size, total);
    }

    public async Task<UserDto> GetAsync(string id, CancellationToken ct) =>
        ToDto(await WithRoles.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw new NotFoundException("User not found"));

    public async Task<UserDto> CreateAsync(CreateUserRequest req, CancellationToken ct)
    {
        if (await db.UserAccounts.AnyAsync(u => u.Username == req.Username || u.Email == req.Email, ct)) throw new ConflictException("Username or email already exists");
        if (req.EmployeeId is not null && await db.UserAccounts.AnyAsync(u => u.EmployeeId == req.EmployeeId, ct)) throw new ConflictException("Employee already has a user account");
        var roles = await ResolveRolesAsync(req.Roles, ct);
        var user = new UserAccount { Username = req.Username, Email = req.Email, EmployeeId = req.EmployeeId, Status = "ACTIVE", Version = 0 };
        Services.AuthService.ApplyPassword(user, req.Password, req.MustChangePassword);
        foreach (var r in roles) user.Roles.Add(r);
        await uow.ExecuteAsync(async () =>
        {
            db.UserAccounts.Add(user);
            await db.SaveChangesAsync(ct);
            await audit.WriteAsync("UserAccount", user.Id, "CREATED", null, new { user.Username, user.Email, roles = req.Roles });
        }, ct);
        return await GetAsync(user.Id, ct);
    }

    public async Task<UserDto> UpdateAsync(string id, UpdateUserRequest req, CancellationToken ct)
    {
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("User not found");
        var before = new { u.Username, u.Email };
        if (req.Email is not null && req.Email != u.Email) { if (await db.UserAccounts.AnyAsync(x => x.Email == req.Email && x.Id != id, ct)) throw new ConflictException("Email already in use"); u.Email = req.Email; }
        if (req.Username is not null && req.Username != u.Username) { if (await db.UserAccounts.AnyAsync(x => x.Username == req.Username && x.Id != id, ct)) throw new ConflictException("Username already in use"); u.Username = req.Username; }
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("UserAccount", id, "UPDATED", before, new { u.Username, u.Email }); }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<UserDto> AssignRolesAsync(string id, List<string> roleNames, CancellationToken ct)
    {
        var u = await WithRoles.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("User not found");
        var before = u.Roles.Select(r => r.Name).ToList();
        var roles = await ResolveRolesAsync(roleNames, ct);
        u.Roles.Clear();
        foreach (var r in roles) u.Roles.Add(r);
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("UserAccount", id, "ROLES_CHANGED", before, roleNames); }, ct);
        await auth.InvalidateSessionsAsync(id, ct);   // old tokens carry stale permissions
        return await GetAsync(id, ct);
    }

    public async Task<UserDto> SetStatusAsync(string id, string status, CancellationToken ct)
    {
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("User not found");
        var before = u.Status;
        u.Status = status;
        if (status == "ACTIVE") { u.FailedAttempts = 0; u.LockedUntil = null; }
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("UserAccount", id, status == "ACTIVE" ? "ACTIVATED" : "DEACTIVATED", new { status = before }, new { status }); }, ct);
        if (status == "INACTIVE") await auth.InvalidateSessionsAsync(id, ct);
        return await GetAsync(id, ct);
    }

    public async Task<UserDto> UnlockAsync(string id, CancellationToken ct)
    {
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("User not found");
        u.FailedAttempts = 0; u.LockedUntil = null; if (u.Status == "LOCKED") u.Status = "ACTIVE";
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("UserAccount", id, "UNLOCKED"); }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<UserDto> LinkEmployeeAsync(string id, string employeeId, CancellationToken ct)
    {
        if (await db.UserAccounts.AnyAsync(x => x.EmployeeId == employeeId && x.Id != id, ct)) throw new ConflictException("Employee already has a user account");
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("User not found");
        var before = u.EmployeeId;
        u.EmployeeId = employeeId;
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("UserAccount", id, "EMPLOYEE_LINKED", new { employeeId = before }, new { employeeId }); }, ct);
        await auth.InvalidateSessionsAsync(id, ct);
        return await GetAsync(id, ct);
    }

    public async Task AdminResetPasswordAsync(string id, string newPassword, CancellationToken ct)
    {
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("User not found");
        Services.AuthService.ApplyPassword(u, newPassword, true);
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("UserAccount", id, "PASSWORD_RESET_BY_ADMIN"); }, ct);
        await auth.InvalidateSessionsAsync(id, ct);
    }

    public Task<List<AuditRecord>> HistoryAsync(string id, CancellationToken ct) => audit.TrailAsync("UserAccount", id, 200, ct);

    public async Task<List<RoleDto>> ListRolesAsync(CancellationToken ct) =>
        (await db.Roles.AsNoTracking().Include(r => r.Permissions).OrderBy(r => r.Name).ToListAsync(ct))
        .Select(r => new RoleDto(r.Id, r.Name, r.Description, r.Permissions.Select(p => p.Code).OrderBy(c => c).ToList())).ToList();

    public async Task<List<PermissionDto>> ListPermissionsAsync(CancellationToken ct) =>
        await db.Permissions.AsNoTracking().OrderBy(p => p.Code).Select(p => new PermissionDto(p.Id, p.Code, p.Description)).ToListAsync(ct);

    public async Task<RoleDto> SetRolePermissionsAsync(string roleId, List<string> codes, CancellationToken ct)
    {
        var role = await db.Roles.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == roleId, ct) ?? throw new NotFoundException("Role not found");
        if (role.Name == Common.Security.Roles.SuperAdmin) throw new ForbiddenException("SUPER_ADMIN permissions are fixed");
        var perms = await db.Permissions.Where(p => codes.Contains(p.Code)).ToListAsync(ct);
        if (perms.Count != codes.Distinct().Count()) throw new Common.Common.ValidationException("One or more permissions do not exist");
        var before = role.Permissions.Select(p => p.Code).ToList();
        role.Permissions.Clear();
        foreach (var p in perms) role.Permissions.Add(p);
        await uow.ExecuteAsync(async () => { await db.SaveChangesAsync(ct); await audit.WriteAsync("Role", roleId, "PERMISSIONS_CHANGED", before, codes); }, ct);
        return (await ListRolesAsync(ct)).First(r => r.Id == roleId);
    }

    /// <summary>Called by the employee exit consumer: deactivates the login and kills every session.</summary>
    public async Task DeactivateByEmployeeAsync(string employeeId, CancellationToken ct)
    {
        var u = await db.UserAccounts.FirstOrDefaultAsync(x => x.EmployeeId == employeeId, ct);
        if (u is null || u.Status == "INACTIVE") return;
        var before = u.Status;
        u.Status = "INACTIVE";
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync("UserAccount", u.Id, "DEACTIVATED_ON_EXIT", new { status = before }, new { status = "INACTIVE" });
        await auth.InvalidateSessionsAsync(u.Id, ct);
    }

    private async Task<List<Role>> ResolveRolesAsync(List<string> names, CancellationToken ct)
    {
        var distinct = names.Select(n => n.Trim().ToUpperInvariant()).Distinct().ToList();
        var roles = await db.Roles.Where(r => distinct.Contains(r.Name)).ToListAsync(ct);
        if (roles.Count != distinct.Count) throw new Common.Common.ValidationException("One or more roles do not exist");
        return roles;
    }
}

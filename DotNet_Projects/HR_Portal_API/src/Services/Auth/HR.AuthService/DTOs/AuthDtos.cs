using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace HR.AuthService.DTOs;

public sealed record LoginRequest([Required, StringLength(150, MinimumLength = 2)] string Username, [Required, StringLength(128, MinimumLength = 1)] string Password);
public sealed record RefreshRequest([Required, StringLength(200, MinimumLength = 20)] string RefreshToken);
public sealed record LogoutRequest(string? RefreshToken);
public sealed record ChangePasswordRequest([Required] string CurrentPassword, [Required] string NewPassword);
public sealed record ForgotPasswordRequest([Required, EmailAddress] string Email);
public sealed record ResetPasswordRequest([Required] string Token, [Required] string NewPassword);
public sealed record AdminResetPasswordRequest([Required] string NewPassword);

public sealed record CreateUserRequest(
    [Required, StringLength(100, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9._-]+$", ErrorMessage = "may contain letters, digits, dot, underscore and hyphen only")] string Username,
    [Required, EmailAddress, StringLength(150)] string Email,
    [Required] string Password,
    string? EmployeeId,
    [Required, MinLength(1)] List<string> Roles,
    bool MustChangePassword = true);

public sealed record UpdateUserRequest([EmailAddress, StringLength(150)] string? Email, string? Username);
public sealed record AssignRolesRequest([Required, MinLength(1)] List<string> Roles);
public sealed record LinkEmployeeRequest([Required, StringLength(36, MinimumLength = 36)] string EmployeeId);
public sealed record SetRolePermissionsRequest([Required] List<string> Permissions);

public sealed record UserDto(string Id, string Username, string Email, string? EmployeeId, string Status, bool MustChangePassword, DateTime? LastLoginAt, DateTime? LockedUntil, DateTime? PasswordChangedAt,
    DateTime CreatedAt, List<string> Roles, List<string> Permissions);

public sealed record AuthUserInfo(string Id, string Username, string Email, string? EmployeeId, List<string> Roles, List<string> Permissions);

public sealed record TokenResponse(string AccessToken, string TokenType, int ExpiresIn, string RefreshToken, bool MustChangePassword, AuthUserInfo User);

public sealed record RoleDto(string Id, string Name, string? Description, List<string> Permissions);
public sealed record PermissionDto(string Id, string Code, string? Description);

public sealed class UserListQuery : HR.Common.Common.PageQuery
{
    public string? Status { get; set; }
    public string? Role { get; set; }
}

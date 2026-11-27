using System.Security.Claims;
using Common.Errors;
using Common.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentService.Dtos;
using StudentService.Services;

namespace StudentService.Controllers;

/// <summary>Registration, login and refresh-token rotation (JWT). Public except /me.</summary>
[ApiController, Route("api/auth"), Tags("Authentication")]
public class AuthController(IAuthService auth) : ControllerBase
{
    /// <summary>Register a user. Anonymous callers create Student accounts (firstName/lastName required); an Admin token may also create Staff/Admin accounts.</summary>
    [HttpPost("register"), AllowAnonymous, ProducesResponseType(typeof(UserResponse), 201)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        // [AllowAnonymous] still lets a valid token through the JWT middleware; read the caller's role if there is one
        var isAdmin = HttpContext.User.Identity?.IsAuthenticated == true && HttpContext.User.IsInRole(Roles.Admin);
        var created = await auth.RegisterAsync(request, isAdmin, ct);
        return StatusCode(201, created);
    }

    /// <summary>Login with username (or e-mail) and password.</summary>
    [HttpPost("login"), AllowAnonymous]
    public Task<TokenResponse> Login(LoginRequest request, CancellationToken ct) => auth.LoginAsync(request, ct);

    /// <summary>Exchange a refresh token for a new access + refresh token pair (the old one is revoked).</summary>
    [HttpPost("refresh"), AllowAnonymous]
    public Task<TokenResponse> Refresh(RefreshRequest request, CancellationToken ct) => auth.RefreshAsync(request.RefreshToken, ct);

    /// <summary>Revoke a refresh token.</summary>
    [HttpPost("logout"), AllowAnonymous, ProducesResponseType(204)]
    public async Task<IActionResult> Logout(RefreshRequest request, CancellationToken ct) { await auth.LogoutAsync(request.RefreshToken, ct); return NoContent(); }

    /// <summary>The current user.</summary>
    [HttpGet("me"), Authorize]
    public Task<UserResponse> Me()
    {
        var id = long.Parse(User.FindFirstValue("sub") ?? throw new UnauthorizedAppException("Missing subject"));
        return auth.MeAsync(id);
    }
}

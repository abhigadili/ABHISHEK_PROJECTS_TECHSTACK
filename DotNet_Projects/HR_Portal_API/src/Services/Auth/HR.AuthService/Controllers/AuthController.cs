using Asp.Versioning;
using HR.AuthService.DTOs;
using HR.AuthService.Services;
using HR.Common.Hosting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HR.AuthService.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
public sealed class AuthController(IAuthService auth) : HrControllerBase
{
    [HttpPost("login"), AllowAnonymous, RateLimit(30)]
    public async Task<ActionResult<TokenResponse>> Login(LoginRequest req, CancellationToken ct) => Ok(await auth.LoginAsync(req, HttpContext.Connection.RemoteIpAddress?.ToString(), ct));

    [HttpPost("refresh"), AllowAnonymous, RateLimit(60)]
    public async Task<ActionResult<TokenResponse>> Refresh(RefreshRequest req, CancellationToken ct) => Ok(await auth.RefreshAsync(req.RefreshToken, HttpContext.Connection.RemoteIpAddress?.ToString(), ct));

    [HttpPost("logout"), Authorize]
    public async Task<IActionResult> Logout(LogoutRequest req, CancellationToken ct) { await auth.LogoutAsync(req.RefreshToken, ct); return NoContent(); }

    [HttpGet("me"), Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct) => Ok(await auth.MeAsync(ct));

    [HttpPost("password/change"), Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest req, CancellationToken ct) { await auth.ChangePasswordAsync(req, ct); return NoContent(); }

    [HttpPost("password/forgot"), AllowAnonymous, RateLimit(10)]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest req, CancellationToken ct) { await auth.ForgotPasswordAsync(req.Email, ct); return Ok(new { message = "If the account exists, a reset token has been sent" }); }

    [HttpPost("password/reset"), AllowAnonymous, RateLimit(10)]
    public async Task<IActionResult> Reset(ResetPasswordRequest req, CancellationToken ct) { await auth.ResetPasswordAsync(req.Token, req.NewPassword, ct); return NoContent(); }
}

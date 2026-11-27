using HMS.Hospitals.Dtos;
using HMS.Hospitals.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HMS.Hospitals.Controllers;

/// <summary>Centralised authentication for the whole platform: login issues the JWT every service trusts.</summary>
[ApiController, Route("api/auth")]
public sealed class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("login"), AllowAnonymous]
    public Task<TokenResponse> Login([FromBody] LoginRequest r) => auth.LoginAsync(r);

    [HttpPost("register"), AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest r) => StatusCode(201, await auth.RegisterPatientAsync(r));

    [HttpGet("me"), Authorize]
    public Task<UserResponse> Me() => auth.MeAsync();
}

[ApiController, Route("api/users"), Authorize(Roles = "ADMIN")]
public sealed class UsersController(IAuthService auth) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest r) => StatusCode(201, await auth.CreateUserAsync(r));

    [HttpGet]
    public Task<List<UserResponse>> List(CancellationToken ct) => auth.ListAsync(ct);

    [HttpPatch("{id:long}/enabled")]
    public Task<UserResponse> Enabled(long id, [FromBody] EnabledRequest r) => auth.SetEnabledAsync(id, r.Enabled!.Value);
}

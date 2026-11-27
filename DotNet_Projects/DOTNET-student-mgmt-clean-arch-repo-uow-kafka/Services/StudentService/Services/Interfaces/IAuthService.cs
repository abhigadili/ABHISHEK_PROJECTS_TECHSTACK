using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.DTOs.Responses;

namespace StudentMgmt.StudentService.Services.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    Task<AuthResponse> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);

    Task RevokeTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
}

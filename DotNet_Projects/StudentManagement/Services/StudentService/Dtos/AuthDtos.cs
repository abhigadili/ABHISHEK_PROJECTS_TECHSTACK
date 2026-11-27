using System.ComponentModel.DataAnnotations;
using StudentService.Validation;

namespace StudentService.Dtos;

public record RegisterRequest(
    [Required, StringLength(50, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9._-]+$", ErrorMessage = "letters, digits, . _ - only")] string Username,
    [Required, EmailAddress, StringLength(100)] string Email,
    [Required, StringLength(72, MinimumLength = 8)] string Password,
    string? Role,
    [StringLength(50)] string? FirstName,
    [StringLength(50)] string? LastName,
    [OptionalPhone] string? PhoneNumber);

public record LoginRequest([Required] string Username, [Required] string Password);
public record RefreshRequest([Required] string RefreshToken);
public record TokenResponse(string AccessToken, string RefreshToken, string TokenType, long ExpiresInSeconds, string Username, string Role, long? StudentId);
public record UserResponse(long UserId, string Username, string Email, string Role, long? StudentId);

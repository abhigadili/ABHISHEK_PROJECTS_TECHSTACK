using FluentValidation;
using Microsoft.Extensions.Logging;
using StudentMgmt.BuildingBlocks.Common.Constants;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Common.Security;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.DTOs.Responses;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Kafka.Producers;
using StudentMgmt.StudentService.Services.Interfaces;
using StudentMgmt.StudentService.UnitOfWork;

namespace StudentMgmt.StudentService.Services;

public class AuthService : IAuthService
{
    private readonly IStudentUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly StudentEventPublisher _eventPublisher;
    private readonly IValidator<RegisterRequest> _registerValidator;
    private readonly IValidator<LoginRequest> _loginValidator;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IStudentUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        StudentEventPublisher eventPublisher,
        IValidator<RegisterRequest> registerValidator,
        IValidator<LoginRequest> loginValidator,
        ILogger<AuthService> logger)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _eventPublisher = eventPublisher;
        _registerValidator = registerValidator;
        _loginValidator = loginValidator;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _registerValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            throw new ValidationAppException(ToErrorDictionary(validationResult));
        }

        if (await _unitOfWork.Users.EmailExistsAsync(request.Email, cancellationToken))
        {
            throw new BusinessRuleException($"A user with email '{request.Email}' already exists.");
        }

        var roleName = string.IsNullOrWhiteSpace(request.Role) ? RoleConstants.Student : request.Role!;
        var role = await _unitOfWork.Roles.GetByNameAsync(roleName, cancellationToken)
            ?? throw new BusinessRuleException($"Role '{roleName}' does not exist.");

        var user = new ApplicationUser
        {
            FullName = $"{request.FirstName} {request.LastName}".Trim(),
            Email = request.Email,
            PasswordHash = _passwordHasher.Hash(request.Password)
        };

        Student? createdStudent = null;

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await _unitOfWork.Users.AddAsync(user, cancellationToken);
            await _unitOfWork.Users.AssignRoleAsync(user.Id, role.Id, cancellationToken);

            if (string.Equals(roleName, RoleConstants.Student, StringComparison.OrdinalIgnoreCase))
            {
                createdStudent = new Student
                {
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    Email = request.Email,
                    PhoneNumber = request.PhoneNumber,
                    DateOfBirth = request.DateOfBirth ?? DateTime.UtcNow.AddYears(-18),
                    EnrollmentNumber = EnrollmentNumberGenerator.Generate(),
                    UserId = user.Id
                };

                await _unitOfWork.Students.AddAsync(createdStudent, cancellationToken);
            }

            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        if (createdStudent is not null)
        {
            // Fire-and-forget: see StudentAppService.PublishFireAndForget for why this is
            // never awaited inline — the shared Kafka producer can block for minutes when
            // the broker is unreachable, and the MySQL transaction has already committed.
            var studentForEvent = createdStudent;
            _ = Task.Run(async () =>
            {
                try
                {
                    await _eventPublisher.PublishStudentCreatedAsync(studentForEvent, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to publish StudentCreatedEvent for student {StudentId} created during registration.", studentForEvent.Id);
                }
            });
        }

        var generatedToken = _jwtTokenService.GenerateToken(user.Id, user.Email, user.FullName, new[] { roleName });
        await PersistRefreshTokenAsync(user.Id, generatedToken, cancellationToken);

        return BuildAuthResponse(user, generatedToken, new[] { roleName }, createdStudent?.Id);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _loginValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            throw new ValidationAppException(ToErrorDictionary(validationResult));
        }

        var result = await _unitOfWork.Users.GetByEmailWithRolesAsync(request.Email, cancellationToken);
        if (result is null || !_passwordHasher.Verify(request.Password, result.Value.User.PasswordHash))
        {
            throw new AuthenticationFailedException("Invalid email or password.");
        }

        var (user, roles) = result.Value;

        var generatedToken = _jwtTokenService.GenerateToken(user.Id, user.Email, user.FullName, roles);
        await PersistRefreshTokenAsync(user.Id, generatedToken, cancellationToken);

        var linkedStudentId = (await _unitOfWork.Students.FindAsync(s => s.UserId == user.Id, cancellationToken)).FirstOrDefault()?.Id;
        return BuildAuthResponse(user, generatedToken, roles, linkedStudentId);
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var existingToken = await _unitOfWork.RefreshTokens.GetByTokenValueAsync(refreshToken, cancellationToken)
            ?? throw new AuthenticationFailedException("Invalid refresh token.");

        if (!existingToken.IsActive)
        {
            throw new AuthenticationFailedException("Refresh token is expired or has already been revoked.");
        }

        var user = await _unitOfWork.Users.GetByIdAsync(existingToken.UserId, cancellationToken)
            ?? throw new AuthenticationFailedException("The user associated with this refresh token no longer exists.");

        var roles = await _unitOfWork.Users.GetRoleNamesForUserAsync(user.Id, cancellationToken);

        var generatedToken = _jwtTokenService.GenerateToken(user.Id, user.Email, user.FullName, roles);

        existingToken.RevokedAtUtc = DateTime.UtcNow;
        existingToken.ReplacedByToken = generatedToken.RefreshToken;
        _unitOfWork.RefreshTokens.Update(existingToken);

        await _unitOfWork.RefreshTokens.AddAsync(new RefreshToken
        {
            UserId = user.Id,
            Token = generatedToken.RefreshToken,
            ExpiresAtUtc = generatedToken.RefreshTokenExpiresAtUtc
        }, cancellationToken);

        await _unitOfWork.CommitAsync(cancellationToken);

        var linkedStudentId = (await _unitOfWork.Students.FindAsync(s => s.UserId == user.Id, cancellationToken)).FirstOrDefault()?.Id;
        return BuildAuthResponse(user, generatedToken, roles, linkedStudentId);
    }

    public async Task RevokeTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var existingToken = await _unitOfWork.RefreshTokens.GetByTokenValueAsync(refreshToken, cancellationToken)
            ?? throw new NotFoundException(nameof(RefreshToken), refreshToken);

        if (!existingToken.IsActive)
        {
            throw new BusinessRuleException("This refresh token has already been revoked or has expired.");
        }

        existingToken.RevokedAtUtc = DateTime.UtcNow;
        _unitOfWork.RefreshTokens.Update(existingToken);
        await _unitOfWork.CommitAsync(cancellationToken);
    }

    private async Task PersistRefreshTokenAsync(Guid userId, GeneratedToken generatedToken, CancellationToken cancellationToken)
    {
        await _unitOfWork.RefreshTokens.AddAsync(new RefreshToken
        {
            UserId = userId,
            Token = generatedToken.RefreshToken,
            ExpiresAtUtc = generatedToken.RefreshTokenExpiresAtUtc
        }, cancellationToken);

        await _unitOfWork.CommitAsync(cancellationToken);
    }

    private static AuthResponse BuildAuthResponse(ApplicationUser user, GeneratedToken generatedToken, IReadOnlyCollection<string> roles, Guid? studentId = null) =>
        new()
        {
            AccessToken = generatedToken.AccessToken,
            AccessTokenExpiresAtUtc = generatedToken.AccessTokenExpiresAtUtc,
            RefreshToken = generatedToken.RefreshToken,
            RefreshTokenExpiresAtUtc = generatedToken.RefreshTokenExpiresAtUtc,
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Roles = roles.ToArray(),
            StudentId = studentId
        };

    private static IReadOnlyDictionary<string, string[]> ToErrorDictionary(FluentValidation.Results.ValidationResult result) =>
        result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
}

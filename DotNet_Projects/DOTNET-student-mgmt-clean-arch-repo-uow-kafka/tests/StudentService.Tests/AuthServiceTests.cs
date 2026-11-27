using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudentMgmt.BuildingBlocks.Common.Exceptions;
using StudentMgmt.BuildingBlocks.Common.Security;
using StudentMgmt.BuildingBlocks.Messaging;
using StudentMgmt.StudentService.DTOs.Requests;
using StudentMgmt.StudentService.Entities;
using StudentMgmt.StudentService.Kafka.Producers;
using StudentMgmt.StudentService.Repositories.Interfaces;
using StudentMgmt.StudentService.Services;
using StudentMgmt.StudentService.UnitOfWork;
using StudentMgmt.StudentService.Validators;
using Xunit;

namespace StudentMgmt.StudentService.Tests;

public class AuthServiceTests
{
    private readonly Mock<IStudentUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<IStudentRepository> _studentRepositoryMock = new();
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IRoleRepository> _roleRepositoryMock = new();
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock = new();
    private readonly Mock<IPasswordHasher> _passwordHasherMock = new();
    private readonly Mock<IJwtTokenService> _jwtTokenServiceMock = new();
    private readonly Mock<IEventProducer> _eventProducerMock = new();

    public AuthServiceTests()
    {
        _unitOfWorkMock.Setup(u => u.Students).Returns(_studentRepositoryMock.Object);
        _unitOfWorkMock.Setup(u => u.Users).Returns(_userRepositoryMock.Object);
        _unitOfWorkMock.Setup(u => u.Roles).Returns(_roleRepositoryMock.Object);
        _unitOfWorkMock.Setup(u => u.RefreshTokens).Returns(_refreshTokenRepositoryMock.Object);

        // Login/RefreshToken look up the linked Student (if any) to populate AuthResponse.StudentId.
        // Default to "no linked student" so tests that don't care about this can ignore it.
        _studentRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Student, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<Student>());
    }

    private AuthService CreateSut() =>
        new(
            _unitOfWorkMock.Object,
            _passwordHasherMock.Object,
            _jwtTokenServiceMock.Object,
            new StudentEventPublisher(_eventProducerMock.Object),
            new RegisterRequestValidator(),
            new LoginRequestValidator(),
            NullLogger<AuthService>.Instance);

    [Fact]
    public async Task RegisterAsync_UsesTransaction_AndCommitsOnSuccess_ForStudentRole()
    {
        _userRepositoryMock.Setup(r => r.EmailExistsAsync("student@example.com", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _roleRepositoryMock.Setup(r => r.GetByNameAsync("Student", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Role { Name = "Student" });

        var generatedToken = new GeneratedToken("access-token", DateTime.UtcNow.AddMinutes(30), "refresh-token", DateTime.UtcNow.AddDays(7));
        _jwtTokenServiceMock
            .Setup(j => j.GenerateToken(It.IsAny<Guid>(), "student@example.com", It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>()))
            .Returns(generatedToken);
        _passwordHasherMock.Setup(p => p.Hash("Passw0rd1")).Returns("hashed-password");

        var sut = CreateSut();
        var request = new RegisterRequest
        {
            FirstName = "Grace",
            LastName = "Hopper",
            Email = "student@example.com",
            Password = "Passw0rd1",
            DateOfBirth = new DateTime(1998, 3, 3)
        };

        var result = await sut.RegisterAsync(request);

        result.AccessToken.Should().Be("access-token");
        result.Roles.Should().Contain("Student");

        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        _userRepositoryMock.Verify(r => r.AddAsync(It.Is<ApplicationUser>(u => u.Email == "student@example.com"), It.IsAny<CancellationToken>()), Times.Once);
        _userRepositoryMock.Verify(r => r.AssignRoleAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Once);
        _studentRepositoryMock.Verify(r => r.AddAsync(It.Is<Student>(s => s.Email == "student@example.com"), It.IsAny<CancellationToken>()), Times.Once);
        _refreshTokenRepositoryMock.Verify(r => r.AddAsync(It.Is<RefreshToken>(t => t.Token == "refresh-token"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_RollsBackTransaction_WhenPersistenceFails()
    {
        _userRepositoryMock.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _roleRepositoryMock.Setup(r => r.GetByNameAsync("Student", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Role { Name = "Student" });
        _unitOfWorkMock.Setup(u => u.CommitTransactionAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("boom"));

        var sut = CreateSut();
        var request = new RegisterRequest
        {
            FirstName = "Grace",
            LastName = "Hopper",
            Email = "fails@example.com",
            Password = "Passw0rd1",
            DateOfBirth = new DateTime(1998, 3, 3)
        };

        var act = () => sut.RegisterAsync(request);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _unitOfWorkMock.Verify(u => u.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ThrowsBusinessRuleException_WhenEmailAlreadyExists()
    {
        _userRepositoryMock.Setup(r => r.EmailExistsAsync("dup@example.com", It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var sut = CreateSut();
        var request = new RegisterRequest
        {
            FirstName = "Grace",
            LastName = "Hopper",
            Email = "dup@example.com",
            Password = "Passw0rd1"
        };

        var act = () => sut.RegisterAsync(request);

        await act.Should().ThrowAsync<BusinessRuleException>();
        _unitOfWorkMock.Verify(u => u.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task LoginAsync_ThrowsAuthenticationFailedException_WhenPasswordIsWrong()
    {
        var user = new ApplicationUser { Email = "user@example.com", FullName = "Some User", PasswordHash = "correct-hash" };
        _userRepositoryMock
            .Setup(r => r.GetByEmailWithRolesAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((user, (IReadOnlyList<string>)new[] { "Student" }));
        _passwordHasherMock.Setup(p => p.Verify("wrong-password", "correct-hash")).Returns(false);

        var sut = CreateSut();
        var request = new LoginRequest { Email = "user@example.com", Password = "wrong-password" };

        var act = () => sut.LoginAsync(request);

        await act.Should().ThrowAsync<AuthenticationFailedException>().WithMessage("Invalid email or password.");
    }

    [Fact]
    public async Task LoginAsync_ThrowsAuthenticationFailedException_WhenUserDoesNotExist()
    {
        _userRepositoryMock
            .Setup(r => r.GetByEmailWithRolesAsync("missing@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(((ApplicationUser User, IReadOnlyList<string> Roles)?)null);

        var sut = CreateSut();
        var request = new LoginRequest { Email = "missing@example.com", Password = "whatever1" };

        var act = () => sut.LoginAsync(request);

        await act.Should().ThrowAsync<AuthenticationFailedException>();
    }

    [Fact]
    public async Task LoginAsync_ReturnsAuthResponse_WhenCredentialsAreValid()
    {
        var user = new ApplicationUser { Email = "user@example.com", FullName = "Some User", PasswordHash = "correct-hash" };
        _userRepositoryMock
            .Setup(r => r.GetByEmailWithRolesAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((user, (IReadOnlyList<string>)new[] { "Student" }));
        _passwordHasherMock.Setup(p => p.Verify("correct-password", "correct-hash")).Returns(true);

        var generatedToken = new GeneratedToken("access-token", DateTime.UtcNow.AddMinutes(30), "refresh-token", DateTime.UtcNow.AddDays(7));
        _jwtTokenServiceMock
            .Setup(j => j.GenerateToken(user.Id, user.Email, user.FullName, It.IsAny<IReadOnlyCollection<string>>()))
            .Returns(generatedToken);

        var sut = CreateSut();
        var request = new LoginRequest { Email = "user@example.com", Password = "correct-password" };

        var result = await sut.LoginAsync(request);

        result.AccessToken.Should().Be("access-token");
        result.Email.Should().Be("user@example.com");
        _refreshTokenRepositoryMock.Verify(r => r.AddAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RefreshTokenAsync_ThrowsAuthenticationFailedException_WhenTokenIsRevoked()
    {
        var revokedToken = new RefreshToken
        {
            UserId = Guid.NewGuid(),
            Token = "revoked-token",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(1),
            RevokedAtUtc = DateTime.UtcNow.AddMinutes(-5)
        };

        _refreshTokenRepositoryMock.Setup(r => r.GetByTokenValueAsync("revoked-token", It.IsAny<CancellationToken>())).ReturnsAsync(revokedToken);

        var sut = CreateSut();

        var act = () => sut.RefreshTokenAsync("revoked-token");

        await act.Should().ThrowAsync<AuthenticationFailedException>();
    }

    [Fact]
    public async Task RefreshTokenAsync_RotatesToken_WhenTokenIsActive()
    {
        var user = new ApplicationUser { Email = "user@example.com", FullName = "Some User", PasswordHash = "hash" };
        var activeToken = new RefreshToken
        {
            UserId = user.Id,
            Token = "active-token",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(1)
        };

        _refreshTokenRepositoryMock.Setup(r => r.GetByTokenValueAsync("active-token", It.IsAny<CancellationToken>())).ReturnsAsync(activeToken);
        _userRepositoryMock.Setup(r => r.GetByIdAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(user);
        _userRepositoryMock.Setup(r => r.GetRoleNamesForUserAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync(new[] { "Student" });

        var newGeneratedToken = new GeneratedToken("new-access-token", DateTime.UtcNow.AddMinutes(30), "new-refresh-token", DateTime.UtcNow.AddDays(7));
        _jwtTokenServiceMock
            .Setup(j => j.GenerateToken(user.Id, user.Email, user.FullName, It.IsAny<IReadOnlyCollection<string>>()))
            .Returns(newGeneratedToken);

        var sut = CreateSut();

        var result = await sut.RefreshTokenAsync("active-token");

        result.AccessToken.Should().Be("new-access-token");
        activeToken.RevokedAtUtc.Should().NotBeNull();
        activeToken.ReplacedByToken.Should().Be("new-refresh-token");
        _refreshTokenRepositoryMock.Verify(r => r.Update(activeToken), Times.Once);
        _refreshTokenRepositoryMock.Verify(r => r.AddAsync(It.Is<RefreshToken>(t => t.Token == "new-refresh-token"), It.IsAny<CancellationToken>()), Times.Once);
    }
}

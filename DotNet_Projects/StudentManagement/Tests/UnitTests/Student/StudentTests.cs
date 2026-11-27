using Common.Caching;
using Common.Errors;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudentService.Dtos;
using StudentService.Entities;
using StudentService.Repositories;
using StudentService.Services;
using StudentService.Validation;

namespace UnitTests.StudentTests;

public class StudentAppServiceTests
{
    private readonly Mock<IStudentRepository> _repo = new();
    private readonly Mock<ICacheService> _cache = new();
    private StudentAppService Svc() => new(_repo.Object, _cache.Object, NullLogger<StudentAppService>.Instance);

    private static StudentRequest Req(string email = "Asha.Rao@Example.com") => new(" Asha ", "Rao ", email, null, null, null, null, null, null);

    [Fact]
    public async Task Create_normalises_fields_and_defaults_to_active()
    {
        StudentService.Entities.Student? saved = null;
        _repo.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), null, default)).ReturnsAsync(false);
        _repo.Setup(r => r.AddAsync(It.IsAny<StudentService.Entities.Student>(), default)).Callback<StudentService.Entities.Student, CancellationToken>((s, _) => saved = s).Returns(Task.CompletedTask);
        var resp = await Svc().CreateAsync(Req());
        Assert.Equal("asha.rao@example.com", saved!.Email);
        Assert.Equal("Asha", saved.FirstName); Assert.Equal("Rao", saved.LastName);
        Assert.Equal(StudentStatus.Active, resp.Status);
        _repo.Verify(r => r.SaveAsync(default), Times.Once);
    }

    [Fact]
    public async Task Create_with_existing_email_conflicts_and_saves_nothing()
    {
        _repo.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), null, default)).ReturnsAsync(true);
        await Assert.ThrowsAsync<ConflictException>(() => Svc().CreateAsync(Req()));
        _repo.Verify(r => r.SaveAsync(default), Times.Never);
    }

    [Fact]
    public async Task Get_unknown_student_is_not_found()
    {
        _cache.Setup(c => c.GetOrSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<Func<Task<StudentResponse?>>>(), default))
            .Returns<string, TimeSpan, Func<Task<StudentResponse?>>, CancellationToken>((_, _, loader, _) => loader());
        _repo.Setup(r => r.FindAsync(9, default)).ReturnsAsync((StudentService.Entities.Student?)null);
        await Assert.ThrowsAsync<NotFoundException>(() => Svc().GetAsync(9));
    }

    [Fact]
    public async Task Get_goes_through_the_cache_with_a_ten_minute_ttl()
    {
        var cached = new StudentResponse(5, "A", "B", "a@b.c", null, null, null, null, DateOnly.MinValue, StudentStatus.Active, default, default);
        _cache.Setup(c => c.GetOrSetAsync("student:5", TimeSpan.FromMinutes(10), It.IsAny<Func<Task<StudentResponse?>>>(), default)).ReturnsAsync(cached);
        Assert.Same(cached, await Svc().GetAsync(5));
        _repo.Verify(r => r.FindAsync(It.IsAny<long>(), default), Times.Never);   // a cache hit never touches MySQL
    }

    [Fact]
    public async Task Update_refreshes_the_cache_entry()
    {
        var s = new StudentService.Entities.Student { StudentId = 3, Email = "old@x.com", FirstName = "O", LastName = "L" };
        _repo.Setup(r => r.FindAsync(3, default)).ReturnsAsync(s);
        _repo.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), 3, default)).ReturnsAsync(false);
        await Svc().UpdateAsync(3, Req("new@x.com"));
        _cache.Verify(c => c.SetAsync("student:3", It.IsAny<StudentResponse>(), TimeSpan.FromMinutes(10), default), Times.Once);
        Assert.Equal("new@x.com", s.Email);
    }

    [Fact]
    public async Task Status_change_updates_the_cache_and_delete_evicts_it()
    {
        var s = new StudentService.Entities.Student { StudentId = 3, Email = "a@x.com" };
        _repo.Setup(r => r.FindAsync(3, default)).ReturnsAsync(s);
        var resp = await Svc().UpdateStatusAsync(3, StudentStatus.Inactive);
        Assert.Equal(StudentStatus.Inactive, resp.Status);
        _cache.Verify(c => c.SetAsync("student:3", It.Is<StudentResponse>(x => x.Status == StudentStatus.Inactive), It.IsAny<TimeSpan>(), default), Times.Once);
        await Svc().DeleteAsync(3);
        _repo.Verify(r => r.Remove(s), Times.Once);
        _cache.Verify(c => c.RemoveAsync("student:3", default), Times.Once);
    }

    [Theory]
    [InlineData(StudentStatus.Active, true)]
    [InlineData(StudentStatus.Inactive, false)]
    public async Task Eligibility_requires_active_status(StudentStatus status, bool eligible)
    {
        var r = new StudentResponse(1, "A", "B", "a@b.c", null, null, null, null, DateOnly.MinValue, status, default, default);
        _cache.Setup(c => c.GetOrSetAsync("student:1", It.IsAny<TimeSpan>(), It.IsAny<Func<Task<StudentResponse?>>>(), default)).ReturnsAsync(r);
        var e = await Svc().EligibilityAsync(1);
        Assert.Equal(eligible, e.Eligible);
        Assert.Equal(eligible, e.Reason is null);
    }
}

public class ValidationRuleTests
{
    [Theory]
    [InlineData(null, true)] [InlineData("", true)] [InlineData("+91 98765-43210", true)] [InlineData("(040) 2345 6789", true)]
    [InlineData("12", false)] [InlineData("abcdefghij", false)] [InlineData("+1234567890123456789", false)]
    public void Optional_phone_rules(string? value, bool valid) => Assert.Equal(valid, new OptionalPhoneAttribute().IsValid(value));

    [Fact]
    public void Register_request_validation_rejects_short_password_and_bad_username()
    {
        var r = new RegisterRequest("a b", "not-mail", "short", null, null, null, null);
        var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        var ok = Validate(r, results);
        Assert.False(ok);
        Assert.True(results.Count >= 3);
    }

    // records put validation attributes on constructor parameters: validate by reading them
    private static bool Validate(RegisterRequest r, List<System.ComponentModel.DataAnnotations.ValidationResult> results)
    {
        var ctor = typeof(RegisterRequest).GetConstructors()[0];
        foreach (var p in ctor.GetParameters())
        {
            var value = typeof(RegisterRequest).GetProperty(p.Name!)!.GetValue(r);
            foreach (var attr in p.GetCustomAttributes(typeof(System.ComponentModel.DataAnnotations.ValidationAttribute), false).Cast<System.ComponentModel.DataAnnotations.ValidationAttribute>())
                if (!attr.IsValid(value)) results.Add(new(attr.FormatErrorMessage(p.Name!)));
        }
        return results.Count == 0;
    }
}

public class AuthHashTests
{
    [Fact]
    public void Refresh_token_hash_is_stable_sha256_hex_and_never_equals_the_token()
    {
        var h1 = AuthService.Hash("token-abc"); var h2 = AuthService.Hash("token-abc");
        Assert.Equal(h1, h2); Assert.Equal(64, h1.Length); Assert.NotEqual("token-abc", h1);
        Assert.NotEqual(h1, AuthService.Hash("token-abd"));
    }
}

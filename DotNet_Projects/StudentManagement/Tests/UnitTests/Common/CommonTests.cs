using System.Security.Claims;
using Common.Errors;
using Common.Paging;
using Common.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace UnitTests.CommonTests;

public class JwtTokenServiceTests
{
    private static JwtTokenService Svc(string secret = "unit-test-secret-unit-test-secret-1234", int minutes = 5)
        => new(Options.Create(new JwtOptions { Secret = secret, AccessTokenMinutes = minutes }));

    [Fact]
    public void Token_roundtrip_keeps_roles_and_student_id()
    {
        var jwt = Svc();
        var token = jwt.CreateAccessToken("7", "asha", new[] { Roles.Student }, 42);
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler { MapInboundClaims = false };
        var p = handler.ValidateToken(token, JwtTokenService.ValidationParameters(new JwtOptions { Secret = "unit-test-secret-unit-test-secret-1234" }), out _);
        Assert.True(p.IsInRole(Roles.Student));
        Assert.Equal(42, p.StudentId());
        Assert.False(p.IsStaffOrAdmin());
    }

    [Fact]
    public void Service_token_has_service_role_and_counts_as_staff()
    {
        var token = Svc().CreateServiceToken("enrollment-service");
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler { MapInboundClaims = false };
        var p = handler.ValidateToken(token, JwtTokenService.ValidationParameters(new JwtOptions { Secret = "unit-test-secret-unit-test-secret-1234" }), out _);
        Assert.True(p.IsInRole(Roles.Service));
        Assert.True(p.IsStaffOrAdmin());
    }

    [Fact]
    public void Tampered_or_foreign_tokens_are_rejected()
    {
        var token = Svc().CreateAccessToken("1", "a", new[] { Roles.Admin }, null);
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler { MapInboundClaims = false };
        var other = JwtTokenService.ValidationParameters(new JwtOptions { Secret = "another-secret-another-secret-123456" });
        Assert.ThrowsAny<Exception>(() => handler.ValidateToken(token, other, out _));
        Assert.ThrowsAny<Exception>(() => handler.ValidateToken(token + "x", JwtTokenService.ValidationParameters(new JwtOptions { Secret = "unit-test-secret-unit-test-secret-1234" }), out _));
    }

    [Fact]
    public void Short_secret_is_rejected_at_startup() => Assert.Throws<InvalidOperationException>(() => Svc("short"));
}

public class PagingTests
{
    private static readonly HashSet<string> Allowed = new() { "StudentId", "LastName" };

    [Fact]
    public void Page_size_is_capped_and_negative_page_is_zero()
    {
        var p = PageRequest.Create(-5, 5000, null, "StudentId,asc", Allowed);
        Assert.Equal(0, p.Page); Assert.Equal(100, p.Size); Assert.False(p.Descending);
    }

    [Fact]
    public void Sort_column_is_whitelisted_case_insensitively_and_direction_parsed()
    {
        var p = PageRequest.Create(0, 10, "lastname,DESC", "StudentId,asc", Allowed);
        Assert.Equal("LastName", p.SortBy); Assert.True(p.Descending);
    }

    [Fact]
    public void Unknown_sort_column_is_rejected() => Assert.Throws<ArgumentException>(() => PageRequest.Create(0, 10, "passwordHash", "StudentId,asc", Allowed));

    [Fact]
    public void OrderByName_sorts_in_memory_queries()
    {
        var data = new[] { new Row(2, "b"), new Row(1, "c"), new Row(3, "a") }.AsQueryable();
        Assert.Equal(new[] { 3, 2, 1 }, data.OrderByName("Name", false).Select(r => r.Id).ToArray());
        Assert.Equal(new[] { 3, 2, 1 }, data.OrderByName("Id", true).Select(r => r.Id).ToArray());
    }
    private record Row(int Id, string Name);
}

public class GlobalExceptionHandlerTests
{
    private static async Task<(int status, string body)> Handle(Exception ex)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        ctx.Request.Path = "/api/x";
        await new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance).TryHandleAsync(ctx, ex, default);
        ctx.Response.Body.Position = 0;
        return (ctx.Response.StatusCode, new StreamReader(ctx.Response.Body).ReadToEnd());
    }

    [Theory]
    [InlineData(typeof(NotFoundException), 404)]
    [InlineData(typeof(ConflictException), 409)]
    [InlineData(typeof(BusinessRuleException), 422)]
    [InlineData(typeof(UnauthorizedAppException), 401)]
    [InlineData(typeof(ForbiddenException), 403)]
    [InlineData(typeof(ArgumentException), 400)]
    public async Task Maps_exception_types_to_http_status(Type type, int expected)
    {
        var (status, body) = await Handle((Exception)Activator.CreateInstance(type, "msg")!);
        Assert.Equal(expected, status);
        Assert.Contains($"\"status\":{expected}", body);
    }

    [Fact]
    public async Task Unexpected_errors_are_500_and_do_not_leak_details()
    {
        var (status, body) = await Handle(new InvalidOperationException("secret stack detail"));
        Assert.Equal(500, status);
        Assert.DoesNotContain("secret stack detail", body);
    }

    [Fact]
    public async Task Service_unavailable_is_503() => Assert.Equal(503, (await Handle(new ServiceUnavailableException("down"))).status);
}

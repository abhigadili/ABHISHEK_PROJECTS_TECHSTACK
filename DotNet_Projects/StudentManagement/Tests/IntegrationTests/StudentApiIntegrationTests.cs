extern alias studentsvc;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Common.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MySqlConnector;
using StackExchange.Redis;

namespace IntegrationTests;

/// <summary>The real Student Service pipeline (Kestrel test server, EF migrations on MySQL 8, Redis cache, ASP.NET Identity, JWT): authentication and role-based authorization over HTTP.</summary>
[Collection("infra")]
public class StudentApiIntegrationTests(InfraFixture infra) : IAsyncLifetime
{
    private const string AdminPw = "It-Admin-Passw0rd";
    private WebApplicationFactory<studentsvc::Program> _factory = null!;
    private HttpClient _http = null!;
    private string _cs = "";
    private const string Secret = "integration-test-secret-integration-1234";

    // Program.cs reads configuration (connection string, JWT secret) while the builder is created, i.e. BEFORE WebApplicationFactory's
    // ConfigureAppConfiguration overrides could apply. Environment variables are visible at that moment, so they are used for the overrides.
    // They are set per test class (the "infra" collection runs sequentially) and restored in DisposeAsync.
    private readonly Dictionary<string, string?> _saved = new();
    private void SetEnv(string key, string value) { _saved[key] = Environment.GetEnvironmentVariable(key); Environment.SetEnvironmentVariable(key, value); }

    public async Task InitializeAsync()
    {
        _cs = await infra.NewDatabaseAsync("studentapi");
        SetEnv("ConnectionStrings__StudentDb", _cs); SetEnv("ConnectionStrings__Redis", infra.Redis.GetConnectionString());
        SetEnv("Jwt__Secret", Secret); SetEnv("Bootstrap__AdminPassword", AdminPw); SetEnv("OpenTelemetry__OtlpEndpoint", "");
        _factory = new WebApplicationFactory<studentsvc::Program>();
        _http = _factory.CreateClient();
        // safety net: the service under test MUST be using the throw-away container database, never a real one
        using var scope = _factory.Services.CreateScope();
        Assert.Contains(new MySqlConnectionStringBuilder(_cs).Database, scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>().GetConnectionString("StudentDb"));
    }
    public async Task DisposeAsync() { _http.Dispose(); await _factory.DisposeAsync(); foreach (var (k, v) in _saved) Environment.SetEnvironmentVariable(k, v); }

    private async Task<JsonElement> Json(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>());
    private static HttpRequestMessage Req(HttpMethod m, string url, string? token = null, object? body = null)
    {
        var r = new HttpRequestMessage(m, url);
        if (token != null) r.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body != null) r.Content = JsonContent.Create(body);
        return r;
    }
    private async Task<(string access, string refresh, JsonElement body)> Login(string user, string pw)
    {
        var r = await _http.PostAsJsonAsync("/api/auth/login", new { username = user, password = pw });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await Json(r); return (j.GetProperty("accessToken").GetString()!, j.GetProperty("refreshToken").GetString()!, j);
    }
    private async Task<string> AdminToken() => (await Login("admin", AdminPw)).access;
    private async Task<HttpResponseMessage> Send(HttpMethod m, string url, string? token = null, object? body = null) => await _http.SendAsync(Req(m, url, token, body));

    private static object NewStudent(string email) => new { firstName = "Asha", lastName = "Rao", email };

    [Fact]
    public async Task Login_issues_a_signed_jwt_with_role_claim_and_the_password_is_hashed_in_mysql()
    {
        var (access, _, body) = await Login("admin", AdminPw);
        Assert.Equal("Admin", body.GetProperty("role").GetString());
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler { MapInboundClaims = false };
        var p = handler.ValidateToken(access, JwtTokenService.ValidationParameters(new JwtOptions { Secret = Secret }), out _);
        Assert.True(p.IsInRole("Admin"));

        await using var conn = new MySqlConnection(_cs); await conn.OpenAsync();
        var hash = (string)(await new MySqlCommand("SELECT PasswordHash FROM dn_users WHERE UserName='admin'", conn).ExecuteScalarAsync())!;
        Assert.DoesNotContain(AdminPw, hash); Assert.StartsWith("AQAAAA", hash);          // ASP.NET Identity v3 PBKDF2 format, never plain text
    }

    [Fact]
    public async Task Bad_credentials_give_401_and_repeated_failures_lock_the_account()
    {
        await Send(HttpMethod.Post, "/api/auth/register", null, new { username = "locky", email = "locky@example.com", password = "Passw0rd!", firstName = "L", lastName = "K" });
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Post, "/api/auth/login", null, new { username = "locky", password = "wrong" })).StatusCode);
        var locked = await Send(HttpMethod.Post, "/api/auth/login", null, new { username = "locky", password = "Passw0rd!" });   // even the right password
        Assert.Equal(HttpStatusCode.Unauthorized, locked.StatusCode);
        Assert.Contains("locked", (await Json(locked)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Protected_endpoints_reject_missing_expired_tampered_and_foreign_tokens_with_json_401()
    {
        var none = await Send(HttpMethod.Get, "/api/students");
        Assert.Equal(HttpStatusCode.Unauthorized, none.StatusCode);
        Assert.Equal(401, (await Json(none)).GetProperty("status").GetInt32());
        var admin = await AdminToken();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/students", admin + "x")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/students", "not.a.jwt")).StatusCode);
        var other = new JwtTokenService(Options.Create(new JwtOptions { Secret = "another-secret-another-secret-123456789" })).CreateAccessToken("1", "x", new[] { "Admin" }, null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/students", other)).StatusCode);
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(Secret));
        var expired = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(new System.IdentityModel.Tokens.Jwt.JwtSecurityToken("student-management", "student-management-api",
            new[] { new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Admin") }, DateTime.UtcNow.AddHours(-2), DateTime.UtcNow.AddHours(-1),
            new Microsoft.IdentityModel.Tokens.SigningCredentials(key, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256)));   // correctly signed but expired an hour ago
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/students", expired)).StatusCode);
    }

    [Fact]
    public async Task Role_based_authorization_admin_staff_student()
    {
        var admin = await AdminToken();
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, "/api/auth/register", null, new { username = "evil", email = "evil@example.com", password = "Passw0rd!", role = "Admin" })).StatusCode);   // anonymous cannot self-promote
        Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, "/api/auth/register", admin, new { username = "staff1", email = "staff1@example.com", password = "Passw0rd!", role = "Staff" })).StatusCode);
        var staff = (await Login("staff1", "Passw0rd!")).access;

        var created = await Send(HttpMethod.Post, "/api/students", staff, NewStudent("s1@example.com"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);                          // Staff may create students
        var id = (await Json(created)).GetProperty("studentId").GetInt64();
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Delete, $"/api/students/{id}", staff)).StatusCode);   // but not delete
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/students/{id}", admin)).StatusCode);    // Admin can

        await Send(HttpMethod.Post, "/api/auth/register", null, new { username = "stud1", email = "stud1@example.com", password = "Passw0rd!", firstName = "St", lastName = "Ud" });
        var stu = await Login("stud1", "Passw0rd!"); var myId = stu.body.GetProperty("studentId").GetInt64();
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/students", stu.access)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/students/{myId}", stu.access)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, $"/api/students/{myId + 1000}", stu.access)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Patch, $"/api/students/{myId}/status", stu.access, new { status = "Inactive" })).StatusCode);
        var selfUpdate = await Send(HttpMethod.Put, $"/api/students/{myId}", stu.access, new { firstName = "St", lastName = "Ud", email = "stud1@example.com", status = "Inactive" });
        Assert.Equal(HttpStatusCode.Forbidden, selfUpdate.StatusCode);                      // a student cannot change their own status
    }

    [Fact]
    public async Task Refresh_tokens_rotate_and_logout_revokes()
    {
        var first = await Login("admin", AdminPw);
        var r1 = await Send(HttpMethod.Post, "/api/auth/refresh", null, new { refreshToken = first.refresh });
        Assert.Equal(HttpStatusCode.OK, r1.StatusCode);
        var second = (await Json(r1)).GetProperty("refreshToken").GetString();
        Assert.NotEqual(first.refresh, second);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Post, "/api/auth/refresh", null, new { refreshToken = first.refresh })).StatusCode);   // old one is revoked
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Post, "/api/auth/logout", null, new { refreshToken = second })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Post, "/api/auth/refresh", null, new { refreshToken = second })).StatusCode);

        await using var conn = new MySqlConnection(_cs); await conn.OpenAsync();
        var stored = (string)(await new MySqlCommand("SELECT TokenHash FROM dn_refresh_tokens ORDER BY RefreshTokenId DESC LIMIT 1", conn).ExecuteScalarAsync())!;
        Assert.Equal(64, stored.Length); Assert.NotEqual(second, stored);                  // only the SHA-256 hash is stored
    }

    [Fact]
    public async Task Student_crud_validation_conflict_paging_and_sorting_over_mysql()
    {
        var admin = await AdminToken();
        foreach (var n in new[] { "carl", "anna", "bob" }) Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, "/api/students", admin, new { firstName = n, lastName = "Zed", email = $"{n}@example.com" })).StatusCode);
        var dup = await Send(HttpMethod.Post, "/api/students", admin, NewStudent("CARL@example.com"));
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);                              // e-mail comparison is case-insensitive
        var bad = await Send(HttpMethod.Post, "/api/students", admin, new { firstName = "", lastName = "x", email = "nope", phoneNumber = "12" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var fields = (await Json(bad)).GetProperty("fieldErrors");
        Assert.True(fields.TryGetProperty("email", out _)); Assert.True(fields.TryGetProperty("firstName", out _)); Assert.True(fields.TryGetProperty("phoneNumber", out _));

        var page = await Json(await Send(HttpMethod.Get, "/api/students?search=zed&sort=firstName,asc&size=2", admin));
        Assert.Equal(3, page.GetProperty("totalElements").GetInt64()); Assert.Equal(2, page.GetProperty("content").GetArrayLength());
        Assert.Equal("anna", page.GetProperty("content")[0].GetProperty("firstName").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, "/api/students?sort=PasswordHash", admin)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, "/api/students/999999", admin)).StatusCode);
    }

    [Fact]
    public async Task Student_reads_are_cached_in_redis_updated_on_change_and_evicted_on_delete()
    {
        var admin = await AdminToken();
        var id = (await Json(await Send(HttpMethod.Post, "/api/students", admin, NewStudent("cache@example.com")))).GetProperty("studentId").GetInt64();
        using var mux = await ConnectionMultiplexer.ConnectAsync(infra.Redis.GetConnectionString());
        var key = $"sms:student:{id}";
        Assert.False(await mux.GetDatabase().KeyExistsAsync(key));
        await Send(HttpMethod.Get, $"/api/students/{id}", admin);
        Assert.True(await mux.GetDatabase().KeyExistsAsync(key));                           // cached on first read
        await Send(HttpMethod.Patch, $"/api/students/{id}/status", admin, new { status = "Inactive" });
        Assert.Contains("Inactive", (string)(await mux.GetDatabase().HashGetAsync(key, "data"))!);   // IDistributedCache keeps the payload in hash field "data"   // cache updated, not stale
        var elig = await Json(await Send(HttpMethod.Get, $"/api/students/{id}/eligibility", admin));
        Assert.False(elig.GetProperty("eligible").GetBoolean());
        await Send(HttpMethod.Delete, $"/api/students/{id}", admin);
        Assert.False(await mux.GetDatabase().KeyExistsAsync(key));                          // invalidated
    }

    [Fact]
    public async Task Health_endpoints_report_mysql_and_redis_and_swagger_is_available()
    {
        Assert.Equal(HttpStatusCode.OK, (await _http.GetAsync("/health/live")).StatusCode);
        var ready = await _http.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        var checks = (await Json(ready)).GetProperty("checks");
        Assert.Equal("Healthy", checks.GetProperty("mysql").GetProperty("status").GetString());
        Assert.Equal("Healthy", checks.GetProperty("redis").GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, (await _http.GetAsync("/swagger/v1/swagger.json")).StatusCode);
    }
}

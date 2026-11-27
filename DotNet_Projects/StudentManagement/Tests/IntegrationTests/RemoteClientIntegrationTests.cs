using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using System.Net;
using Common.Errors;
using Common.Security;
using EnrollmentService.Clients;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegrationTests;

/// <summary>Synchronous REST communication: the REAL typed HttpClients + resilience pipeline against a stub HTTP server (Kestrel on a random port).</summary>
public class RemoteClientIntegrationTests : IAsyncLifetime
{
    private WebApplication _stub = null!;
    private string _url = "";
    private int _eligibilityCalls, _courseCalls, _flakyCalls; private string? _lastAuth, _lastCorrelation;
    private volatile bool _courseDown;

    public async Task InitializeAsync()
    {
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Logging.ClearProviders();
        _stub = b.Build();
        _stub.MapGet("/api/students/{id:long}/eligibility", (long id, HttpContext c) =>
        {
            Interlocked.Increment(ref _eligibilityCalls); _lastAuth = c.Request.Headers.Authorization; _lastCorrelation = c.Request.Headers["X-Correlation-Id"];
            return id == 404 ? Results.NotFound() : Results.Json(new { studentId = id, eligible = id != 2, reason = id == 2 ? "Student is Inactive" : null });
        });
        _stub.MapGet("/api/students/{id:long}", (long id) => id == 500 && Interlocked.Increment(ref _flakyCalls) <= 2 ? Results.StatusCode(500)
            : Results.Json(new { studentId = id, firstName = "Asha", lastName = "Rao", email = "a@b.c", status = "Active" }));
        _stub.MapGet("/api/courses/{id:long}", (long id) => { Interlocked.Increment(ref _courseCalls); return _courseDown ? Results.StatusCode(503) : Results.Json(new { courseId = id, courseName = "Java", courseCode = "J", status = "Active", totalSeats = 10, availableSeats = 3 }); });
        _stub.MapPost("/api/courses/{id:long}/seats/reserve", (long id) => Results.Conflict(new { message = "No seats" }));
        _stub.MapPost("/api/courses/{id:long}/seats/release", (long id) => Results.Json(new { courseId = id, enrollmentId = 1, reservationStatus = "Released", availableSeats = 4, replayed = true }));
        await _stub.StartAsync();
        _url = _stub.Urls.First();
    }
    public Task DisposeAsync() => _stub.DisposeAsync().AsTask();

    private ServiceProvider Provider(Dictionary<string, string?>? extra = null)
    {
        var settings = new Dictionary<string, string?>
        {
            ["Services:Student"] = _url, ["Services:Course"] = _url, ["Jwt:Secret"] = "integration-test-secret-integration-1234",
            ["Resilience:RetryDelayMs"] = "50", ["Resilience:BreakerMinimumThroughput"] = "4", ["Resilience:BreakerDurationSeconds"] = "5", ["Resilience:AttemptTimeoutSeconds"] = "2",
        };
        foreach (var (k, v) in extra ?? new()) settings[k] = v;                              // overrides win
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var s = new ServiceCollection();
        s.AddLogging(); s.AddHttpContextAccessor();
        s.Configure<JwtOptions>(cfg.GetSection("Jwt")); s.AddSingleton<JwtTokenService>();
        s.AddRemoteClients(cfg);
        return s.BuildServiceProvider();
    }

    [Fact]
    public async Task Typed_client_sends_a_service_jwt_and_deserialises_the_response()
    {
        using var sp = Provider();
        var e = await sp.GetRequiredService<IStudentClient>().EligibilityAsync(7);
        Assert.True(e.Eligible);
        Assert.StartsWith("Bearer ", _lastAuth);
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(_lastAuth!["Bearer ".Length..], JwtTokenService.ValidationParameters(new JwtOptions { Secret = "integration-test-secret-integration-1234" }), out _);
        Assert.True(principal.IsInRole(Roles.Service));                                   // role Service lets Student/Course Service authorise the call
        Assert.False((await sp.GetRequiredService<IStudentClient>().EligibilityAsync(2)).Eligible);
    }

    [Fact]
    public async Task Http_status_codes_map_to_business_exceptions_without_retries()
    {
        using var sp = Provider(); var students = sp.GetRequiredService<IStudentClient>(); var courses = sp.GetRequiredService<ICourseClient>();
        var before = _eligibilityCalls;
        await Assert.ThrowsAsync<RemoteNotFoundException>(() => students.EligibilityAsync(404));
        Assert.Equal(before + 1, _eligibilityCalls);                                      // 404 is a business answer: exactly one attempt
        await Assert.ThrowsAsync<RemoteConflictException>(() => courses.ReserveSeatAsync(1, 1));
        Assert.True((await courses.ReleaseSeatAsync(1, 1)).Replayed);
    }

    [Fact]
    public async Task Transient_500s_are_retried_until_the_call_succeeds()
    {
        using var sp = Provider();
        var s = await sp.GetRequiredService<IStudentClient>().GetAsync(500);              // stub fails twice, then answers
        Assert.Equal("Asha Rao", s.FullName);
        Assert.Equal(3, _flakyCalls);
    }

    [Fact]
    public async Task Persistent_failures_open_the_circuit_breaker_and_later_calls_fail_fast()
    {
        _courseDown = true;
        using var sp = Provider(); var courses = sp.GetRequiredService<ICourseClient>();
        for (var i = 0; i < 4; i++) await Assert.ThrowsAsync<ServiceUnavailableException>(() => courses.GetAsync(1));
        var callsBefore = _courseCalls;
        var ex = await Assert.ThrowsAsync<ServiceUnavailableException>(() => courses.GetAsync(1));
        Assert.Contains("circuit breaker is OPEN", ex.Message);
        Assert.Equal(callsBefore, _courseCalls);                                          // the open circuit did not even reach the stub
        _courseDown = false;
    }

    [Fact]
    public async Task Unreachable_service_becomes_service_unavailable()
    {
        using var sp = Provider(new() { ["Services:Course"] = "http://127.0.0.1:1", ["Resilience:RetryAttempts"] = "1" });
        await Assert.ThrowsAsync<ServiceUnavailableException>(() => sp.GetRequiredService<ICourseClient>().GetAsync(1));
    }
}

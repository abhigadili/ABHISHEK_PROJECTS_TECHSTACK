using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Common.Errors;
using Common.Security;
using Common.Web;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace EnrollmentService.Clients;

// ---- consumer-side views of the other services' responses (NOT shared with their entities) --------------------------------------
public record StudentInfo(long StudentId, string FirstName, string LastName, string Email, string Status)
{ public string FullName => $"{FirstName} {LastName}".Trim(); }
public record EligibilityInfo(long StudentId, bool Eligible, string? Reason);
public record CourseInfo(long CourseId, string CourseName, string CourseCode, string Status, int TotalSeats, int AvailableSeats);
public record AvailabilityInfo(long CourseId, string Status, int TotalSeats, int AvailableSeats, bool Available);
public record SeatCommand(long EnrollmentId);
public record SeatResult(long CourseId, long EnrollmentId, string ReservationStatus, int AvailableSeats, bool Replayed);

// ---- exceptions: business answers vs technical failures ------------------------------------------------------------------------
/// <summary>The dependency answered 404. A business answer: never retried, never trips the circuit breaker.</summary>
public class RemoteNotFoundException(string m) : Exception(m);
/// <summary>The dependency answered 409 (e.g. no seats left).</summary>
public class RemoteConflictException(string m) : Exception(m);
/// <summary>Other 4xx: the dependency understood and refused the request.</summary>
public class RemoteRejectedException(string m) : Exception(m);

public interface IStudentClient
{
    Task<EligibilityInfo> EligibilityAsync(long studentId, CancellationToken ct = default);
    Task<StudentInfo> GetAsync(long studentId, CancellationToken ct = default);
}

public interface ICourseClient
{
    Task<CourseInfo> GetAsync(long courseId, CancellationToken ct = default);
    Task<AvailabilityInfo> AvailabilityAsync(long courseId, CancellationToken ct = default);
    Task<SeatResult> ReserveSeatAsync(long courseId, long enrollmentId, CancellationToken ct = default);
    Task<SeatResult> ReleaseSeatAsync(long courseId, long enrollmentId, CancellationToken ct = default);
}

/// <summary>
/// Typed HttpClient base: translates HTTP status codes into exceptions and resilience-pipeline failures (circuit open, timeout, network)
/// into ServiceUnavailableException. Retry / circuit breaker / timeouts are configured on the HttpClient (Program.cs, AddResilienceHandler).
/// </summary>
public abstract class RemoteClientBase(HttpClient http, string service)
{
    protected static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    protected async Task<T> SendAsync<T>(HttpMethod method, string url, object? body, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(method, url);
            if (body != null) req.Content = JsonContent.Create(body, options: Json);
            using var res = await http.SendAsync(req, ct);
            if (res.IsSuccessStatusCode) return (await res.Content.ReadFromJsonAsync<T>(Json, ct))!;
            var msg = $"{service} {method} {url} -> HTTP {(int)res.StatusCode}";
            throw res.StatusCode switch
            {
                HttpStatusCode.NotFound => new RemoteNotFoundException(msg),
                HttpStatusCode.Conflict => new RemoteConflictException(msg),
                >= HttpStatusCode.BadRequest and < HttpStatusCode.InternalServerError and not HttpStatusCode.RequestTimeout and not HttpStatusCode.TooManyRequests => new RemoteRejectedException(msg),
                _ => new ServiceUnavailableException($"{service} unavailable: HTTP {(int)res.StatusCode}"),
            };
        }
        catch (BrokenCircuitException e) { throw new ServiceUnavailableException($"{service} circuit breaker is OPEN", e); }
        catch (TimeoutRejectedException e) { throw new ServiceUnavailableException($"{service} timed out", e); }
        catch (HttpRequestException e) { throw new ServiceUnavailableException($"{service} unreachable: {e.Message}", e); }
        catch (TaskCanceledException e) when (!ct.IsCancellationRequested) { throw new ServiceUnavailableException($"{service} timed out", e); }
    }
}

public class StudentClient(HttpClient http) : RemoteClientBase(http, "student-service"), IStudentClient
{
    public Task<EligibilityInfo> EligibilityAsync(long id, CancellationToken ct = default) => SendAsync<EligibilityInfo>(HttpMethod.Get, $"/api/students/{id}/eligibility", null, ct);
    public Task<StudentInfo> GetAsync(long id, CancellationToken ct = default) => SendAsync<StudentInfo>(HttpMethod.Get, $"/api/students/{id}", null, ct);
}

public class CourseClient(HttpClient http) : RemoteClientBase(http, "course-service"), ICourseClient
{
    public Task<CourseInfo> GetAsync(long id, CancellationToken ct = default) => SendAsync<CourseInfo>(HttpMethod.Get, $"/api/courses/{id}", null, ct);
    public Task<AvailabilityInfo> AvailabilityAsync(long id, CancellationToken ct = default) => SendAsync<AvailabilityInfo>(HttpMethod.Get, $"/api/courses/{id}/availability", null, ct);
    public Task<SeatResult> ReserveSeatAsync(long id, long enrollmentId, CancellationToken ct = default) => SendAsync<SeatResult>(HttpMethod.Post, $"/api/courses/{id}/seats/reserve", new SeatCommand(enrollmentId), ct);
    public Task<SeatResult> ReleaseSeatAsync(long id, long enrollmentId, CancellationToken ct = default) => SendAsync<SeatResult>(HttpMethod.Post, $"/api/courses/{id}/seats/release", new SeatCommand(enrollmentId), ct);
}

/// <summary>Adds the service-to-service JWT (role Service, 5 minutes) and propagates the correlation id on every outgoing call.</summary>
public class ServiceAuthHandler(JwtTokenService tokens, IHttpContextAccessor accessor) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.Authorization = new("Bearer", tokens.CreateServiceToken("enrollment-service"));
        var cid = CorrelationIdMiddleware.Current(accessor.HttpContext) ?? SagaCorrelation.Current;
        if (!string.IsNullOrEmpty(cid)) request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.Header, cid);
        return base.SendAsync(request, ct);
    }
}

/// <summary>Ambient correlation id for work that is not an HTTP request (saga recovery, background jobs).</summary>
public static class SagaCorrelation
{
    private static readonly AsyncLocal<string?> Value = new();
    public static string? Current { get => Value.Value; set => Value.Value = value; }
}
